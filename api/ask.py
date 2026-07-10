"""
api/ask.py
────────────────────────────────────────────────────────────────────────────
"Ask the data" — the one AI surface the PRD keeps and hardens (§6.4), as
distinct from the per-page auto-narration it replaces (see api/commentary.py
docstring — that per-page "Key Finding" generator is superseded by the
hand-authored <AnalystNote>/<Recommendation> pairs on each page now).

Hardening rules (PRD §6.4), enforced here:
  1. Answers ONLY from pre-computed mart summaries passed into the prompt —
     never free-form SQL from the LLM, never a number it invented. Reuses
     commentary.py's NUMBERS_FN (one real-mart-query function per page) as
     the entire knowledge base; the model never touches DuckDB directly.
  2. Every answer cites which mart(s)/page(s) it drew from.
  3. If the question can't be answered from available marts, the model must
     say so plainly — an honest empty state, not a hallucinated answer. The
     same numeric-grounding guardrail commentary.py uses (every number in
     the answer must trace back to a number actually in the knowledge base)
     enforces this in code, not just via a prompt instruction.
"""

import json
import logging
import os
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.commentary import NUMBERS_FN, PAGE_LABEL, _allowed_number_set, _extract_numbers, _normalize_value

logger = logging.getLogger("ask")

router = APIRouter()

# Which mart(s)/table(s) actually back each page's numbers — shown to the
# user as source chips, so "which mart(s) it used" (§6.4) is never just the
# page name.
MART_SOURCES = {
    "exec_summary": ["main_marts.mart_revenue", "main_marts.mart_rfm"],
    "revenue": ["main_marts.mart_revenue"],
    "cohorts": ["main_marts.mart_cohorts", "main_marts.mart_rfm"],
    "segments": ["ml.segment_economics", "ml.segmentation_metrics"],
    "sellers": ["main_marts.mart_sellers"],
    "logistics": ["main_marts.mart_logistics"],
}

ASK_TOOL = {
    "name": "answer_from_data",
    "description": "Answer a question about the dashboard using only the supplied mart numbers.",
    "input_schema": {
        "type": "object",
        "properties": {
            "can_answer": {
                "type": "boolean",
                "description": "True only if the supplied numbers actually contain what's needed to answer the question.",
            },
            "answer": {
                "type": "string",
                "description": (
                    "If can_answer is true: a concise, numbers-grounded answer citing only figures given below. "
                    "If can_answer is false: a plain, honest statement of what mart/data would be needed and that "
                    "it isn't available here — never a guess."
                ),
            },
            "used_pages": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Which of the provided page keys the answer actually drew numbers from (empty if can_answer is false).",
            },
        },
        "required": ["can_answer", "answer", "used_pages"],
    },
}


class AskRequest(BaseModel):
    question: str


def _build_knowledge_base() -> dict:
    """Every real number available to the model, grouped by page/mart —
    computed fresh from the marts each call via the same functions
    api/commentary.py uses for its per-page findings. No caching here:
    unlike commentary (page-scoped, cache-keyed on a numbers hash), a
    free-form question can't be pre-enumerated, so there's no cache key
    to hang a cache off other than re-running these (cheap, read-only)
    mart queries per request."""
    kb = {}
    for page, fn in NUMBERS_FN.items():
        try:
            kb[page] = fn()
        except Exception as e:
            logger.warning("ask: failed to compute numbers for %s: %s — omitting from knowledge base", page, e)
    return kb


# This dataset is R$ (Brazilian Real) only — never USD (PRD §8.2). A prompt
# instruction alone isn't enough given this is meant to be enforced in code,
# not discipline (same rationale as the numeric grounding guardrail below):
# a bare "$" the model slips in anyway is mechanically rewritten to "R$"
# rather than shipped as-is.
def _enforce_brl(answer: str) -> str:
    return re.sub(r"(?<!R)\$", "R$", answer)


def _infer_used_pages(answer: str, kb: dict) -> list:
    """Determined from code, not the model's self-report (found unreliable in
    testing — the model sometimes leaves used_pages empty even when its
    answer clearly draws on a specific page's numbers). A page counts as
    "used" if any number cited in the answer also appears in that page's
    own numbers dict — the same matching logic the grounding guardrail uses,
    just per-page instead of pooled."""
    cited = {_normalize_value(t) for t in _extract_numbers(answer)}
    cited.discard(None)
    used = []
    for page, numbers in kb.items():
        page_allowed = _allowed_number_set({page: numbers})
        if cited & page_allowed:
            used.append(page)
    return used


def _answer_is_grounded(answer: str, allowed: set) -> bool:
    for tok in _extract_numbers(answer):
        is_percent = tok.endswith("%")
        cleaned = tok.rstrip("%").replace(",", "")
        norm = _normalize_value(tok)
        if norm is None:
            continue
        if not is_percent and "." not in cleaned and abs(float(cleaned)) < 100:
            continue
        if norm not in allowed:
            logger.warning("ask guardrail: dropping answer citing ungrounded number %r (normalized %r)", tok, norm)
            return False
    return True


@router.post("/api/ask")
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question must not be empty")

    kb = _build_knowledge_base()
    if not kb:
        return {
            "answer": "The warehouse isn't reachable right now, so there's nothing to answer from — try again once it's back.",
            "can_answer": False,
            "used_pages": [],
            "sources": [],
            "source": "unavailable",
        }

    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {
            "answer": "AI answering isn't configured in this environment (no API key) — the underlying mart data is real either way; this panel just can't narrate it right now.",
            "can_answer": False,
            "used_pages": [],
            "sources": [],
            "source": "unavailable",
        }

    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    kb_labeled = {f"{page} ({PAGE_LABEL.get(page, page)})": numbers for page, numbers in kb.items()}
    prompt = f"""You answer questions about an e-commerce analytics dashboard (Olist marketplace data, 2016-2018).

Here are the ONLY numbers available to you, grouped by page/mart. Do not compute new figures, do not invent numbers, do not estimate anything not listed here:

{json.dumps(kb_labeled, indent=2)}

Question: {question}

Call answer_from_data. If the numbers above don't cover what's being asked, set can_answer=false and say plainly what mart/data would be needed — never guess or extrapolate. All currency in your answer must be formatted as "R$" (Brazilian Real) — this dashboard never uses a bare "$"."""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            tools=[ASK_TOOL],
            tool_choice={"type": "tool", "name": "answer_from_data"},
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        logger.warning("ask: Claude call failed: %s", e)
        return {
            "answer": "The AI call failed — try again in a moment.",
            "can_answer": False,
            "used_pages": [],
            "sources": [],
            "source": "unavailable",
        }

    tool_use = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_use is None:
        return {
            "answer": "The model didn't return a structured answer — try rephrasing the question.",
            "can_answer": False,
            "used_pages": [],
            "sources": [],
            "source": "unavailable",
        }

    result = tool_use.input
    can_answer = bool(result.get("can_answer"))
    answer = _enforce_brl(result.get("answer", ""))
    used_pages = _infer_used_pages(answer, kb) if can_answer else []

    if can_answer:
        allowed = _allowed_number_set(kb)
        if not _answer_is_grounded(answer, allowed):
            return {
                "answer": "The model's answer cited a number that isn't in the available mart data, so it was dropped rather than shown — try rephrasing, or this may genuinely be outside what's tracked here.",
                "can_answer": False,
                "used_pages": [],
                "sources": [],
                "source": "unavailable",
            }

    sources = sorted({m for p in used_pages for m in MART_SOURCES.get(p, [])})

    return {
        "answer": answer,
        "can_answer": can_answer,
        "used_pages": used_pages,
        "sources": sources,
        "source": "ai",
    }
