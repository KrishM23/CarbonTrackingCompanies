import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.migrate import migrate
from app.routers import analytics, auth, company, emissions, reports

Base.metadata.create_all(bind=engine)
migrate()

if os.environ.get("SEED_ON_START", "1") == "1":
    try:
        from app.seed import seed

        seed()
    except Exception as exc:  # pragma: no cover - startup resilience
        print(f"Seed skipped: {exc}")

app = FastAPI(
    title="Vapor API",
    description="B2B carbon/ESG tracking — forecast, simulate, roadmap, report",
    version="0.3.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
# Allow all when "*" present (Netlify preview URLs vary)
allow_all = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(company.router)
app.include_router(emissions.router)
app.include_router(analytics.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "vapor", "version": "0.3.0"}
