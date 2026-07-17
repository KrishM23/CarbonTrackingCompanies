from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = ""
    company_name: str = Field(min_length=1, max_length=255)
    industry: str = ""
    baseline_year: int = Field(default=2019, ge=1990, le=2100)
    target_year: int = Field(default=2035, ge=2000, le=2100)
    reduction_pct: float = Field(default=0.5)
    employee_count: int = Field(default=0, ge=0)
    annual_revenue_m: float = Field(default=0, ge=0)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("company_name", "full_name", "industry")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("reduction_pct")
    @classmethod
    def normalize_reduction(cls, v: float) -> float:
        if v > 1:
            v = v / 100.0
        if v < 0.05 or v > 1.0:
            raise ValueError("Reduction target must be between 5% and 100%")
        return round(v, 4)

    @field_validator("target_year")
    @classmethod
    def target_after_baseline(cls, v: int, info) -> int:
        baseline = info.data.get("baseline_year")
        if baseline is not None and v <= baseline:
            raise ValueError("Target year must be after baseline year")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str

    class Config:
        from_attributes = True


class CompanyOut(BaseModel):
    id: int
    name: str
    industry: str
    baseline_year: int
    target_year: int
    reduction_pct: float
    employee_count: int = 0
    annual_revenue_m: float = 0
    framework: str = "GHG Protocol"
    hq_country: str = "United States"

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    baseline_year: Optional[int] = None
    target_year: Optional[int] = None
    reduction_pct: Optional[float] = None
    employee_count: Optional[int] = None
    annual_revenue_m: Optional[float] = None
    framework: Optional[str] = None
    hq_country: Optional[str] = None

    @field_validator("name", "industry", "framework", "hq_country")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return v.strip()

    @field_validator("reduction_pct")
    @classmethod
    def normalize_reduction(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if v > 1:
            v = v / 100.0
        if v < 0.05 or v > 1.0:
            raise ValueError("Reduction target must be between 5% and 100%")
        return round(v, 4)


class EmissionsIn(BaseModel):
    year: int = Field(ge=1990, le=2100)
    scope1: float = Field(ge=0, default=0)
    scope2: float = Field(ge=0, default=0)
    scope3: float = Field(ge=0, default=0)
    notes: str = ""
    verified: bool = False


class EmissionsOut(BaseModel):
    id: int
    year: int
    scope1: float
    scope2: float
    scope3: float
    total: float
    notes: str
    verified: bool

    class Config:
        from_attributes = True


class EmissionsBulkIn(BaseModel):
    records: List[EmissionsIn]


class LeversIn(BaseModel):
    scope1_cut: float = Field(default=0, ge=0, le=85)
    scope2_cut: float = Field(default=0, ge=0, le=90)
    scope3_cut: float = Field(default=0, ge=0, le=60)
    ramp_years: int = Field(default=12, ge=5, le=20)


class SaveScenarioIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    notes: str = ""
    scope1_cut: float = Field(default=0, ge=0, le=85)
    scope2_cut: float = Field(default=0, ge=0, le=90)
    scope3_cut: float = Field(default=0, ge=0, le=60)
    ramp_years: int = Field(default=12, ge=5, le=20)


class SavedScenarioOut(BaseModel):
    id: int
    name: str
    notes: str
    scope1_cut: float
    scope2_cut: float
    scope3_cut: float
    ramp_years: int
    scenario_end: float
    improvement: float
    on_track: bool

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserOut
    company: CompanyOut
