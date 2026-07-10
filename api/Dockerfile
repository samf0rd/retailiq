# api/Dockerfile
# FastAPI read layer over the DuckDB warehouse file.
# The warehouse file itself is NOT baked into the image (it's data, not code) —
# it's mounted as a volume at runtime so a warehouse rebuild doesn't require
# a new image build.

FROM python:3.11-slim

WORKDIR /app

# System deps DuckDB sometimes wants for building from source wheels; slim
# image usually has prebuilt wheels available so this stays minimal.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/

ENV RETAILIQ_DB_PATH=/data/retailiq.duckdb
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# --workers 1: DuckDB's read-only single-file connection is the constraint
# from db.py's docstring — keep one worker unless that's revisited.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
