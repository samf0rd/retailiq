# RetailIQ — developer shortcuts
# Run from repo root.

.PHONY: install ingest dbt-debug dbt-build dbt-test clean

## Set up virtual environment and install deps
install:
	python -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r requirements.txt
	@echo "\nDone. Activate with: source .venv/bin/activate"

## Load Olist CSVs into DuckDB raw schema
ingest:
	python ingestion/load_raw.py

## Verify dbt + DuckDB connection
dbt-debug:
	cd dbt && dbt debug --profiles-dir .

## Run all models + tests
dbt-build:
	cd dbt && dbt build --profiles-dir .

## Tests only
dbt-test:
	cd dbt && dbt test --profiles-dir .

## Generate + serve dbt docs
dbt-docs:
	cd dbt && dbt docs generate --profiles-dir . && dbt docs serve --profiles-dir .

## Wipe the warehouse (re-ingest from scratch)
clean-db:
	rm -f warehouse/retailiq.duckdb
	@echo "Warehouse cleared. Run 'make ingest' to reload."
