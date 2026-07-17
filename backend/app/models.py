from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="user", uselist=False)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str] = mapped_column(String(128), default="")
    baseline_year: Mapped[int] = mapped_column(Integer, default=2019)
    target_year: Mapped[int] = mapped_column(Integer, default=2035)
    reduction_pct: Mapped[float] = mapped_column(Float, default=0.5)
    employee_count: Mapped[int] = mapped_column(Integer, default=0)
    annual_revenue_m: Mapped[float] = mapped_column(Float, default=0.0)  # USD millions
    framework: Mapped[str] = mapped_column(String(64), default="GHG Protocol")
    hq_country: Mapped[str] = mapped_column(String(64), default="United States")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="company")
    emissions: Mapped[list["EmissionsRecord"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    scenarios: Mapped[list["SavedScenario"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class EmissionsRecord(Base):
    __tablename__ = "emissions_records"
    __table_args__ = (UniqueConstraint("company_id", "year", name="uq_company_year"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    scope1: Mapped[float] = mapped_column(Float, default=0.0)
    scope2: Mapped[float] = mapped_column(Float, default=0.0)
    scope3: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    company: Mapped["Company"] = relationship(back_populates="emissions")


class SavedScenario(Base):
    __tablename__ = "saved_scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    notes: Mapped[str] = mapped_column(Text, default="")
    scope1_cut: Mapped[float] = mapped_column(Float, default=0)
    scope2_cut: Mapped[float] = mapped_column(Float, default=0)
    scope3_cut: Mapped[float] = mapped_column(Float, default=0)
    ramp_years: Mapped[int] = mapped_column(Integer, default=12)
    scenario_end: Mapped[float] = mapped_column(Float, default=0)
    improvement: Mapped[float] = mapped_column(Float, default=0)
    on_track: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="scenarios")
