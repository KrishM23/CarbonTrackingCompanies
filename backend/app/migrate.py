"""Lightweight SQLite/Postgres column adds for MVP schema evolution."""

from sqlalchemy import inspect, text

from app.database import engine


COMPANY_COLUMNS = {
    "employee_count": "INTEGER DEFAULT 0",
    "annual_revenue_m": "FLOAT DEFAULT 0",
    "framework": "VARCHAR(64) DEFAULT 'GHG Protocol'",
    "hq_country": "VARCHAR(64) DEFAULT 'United States'",
}


def migrate():
    insp = inspect(engine)
    tables = insp.get_table_names()
    if "companies" in tables:
        existing = {c["name"] for c in insp.get_columns("companies")}
        with engine.begin() as conn:
            for col, ddl in COMPANY_COLUMNS.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col} {ddl}"))

    # Saved scenarios table created via metadata.create_all
