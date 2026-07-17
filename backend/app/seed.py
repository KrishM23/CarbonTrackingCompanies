"""Seed a demo company with sample Scope 1–3 data for local MVP testing."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.migrate import migrate
from app.models import Company, EmissionsRecord, User

SAMPLE = [
    (2019, 42000, 18500, 31000),
    (2020, 38000, 16000, 22000),
    (2021, 39500, 17200, 25500),
    (2022, 41000, 15800, 28000),
    (2023, 38800, 14200, 26500),
    (2024, 36500, 12800, 24800),
]


def seed():
    Base.metadata.create_all(bind=engine)
    migrate()
    db = SessionLocal()
    try:
        email = "demo@acme.corp"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            company = db.query(Company).filter(Company.user_id == existing.id).first()
            if company and (not getattr(company, "employee_count", 0)):
                company.employee_count = 850
                company.annual_revenue_m = 420
                company.framework = "GHG Protocol"
                company.hq_country = "United States"
                db.commit()
                print(f"Updated demo company profile. Login: {email} / demo1234")
            else:
                print(f"Demo user already exists: {email} / demo1234")
            return

        user = User(
            email=email,
            hashed_password=hash_password("demo1234"),
            full_name="Alex Morgan",
        )
        db.add(user)
        db.flush()

        company = Company(
            user_id=user.id,
            name="Acme Manufacturing",
            industry="Industrial goods",
            baseline_year=2019,
            target_year=2035,
            reduction_pct=0.5,
            employee_count=850,
            annual_revenue_m=420,
            framework="GHG Protocol",
            hq_country="United States",
        )
        db.add(company)
        db.flush()

        for year, s1, s2, s3 in SAMPLE:
            db.add(
                EmissionsRecord(
                    company_id=company.id,
                    year=year,
                    scope1=s1,
                    scope2=s2,
                    scope3=s3,
                    total=s1 + s2 + s3,
                    verified=True,
                    notes="Seed data",
                )
            )
        db.commit()
        print("Seeded demo account:")
        print(f"  email:    {email}")
        print(f"  password: demo1234")
        print(f"  company:  Acme Manufacturing")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
