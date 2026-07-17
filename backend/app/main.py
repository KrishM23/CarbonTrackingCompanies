from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.migrate import migrate
from app.routers import analytics, auth, company, emissions, reports

Base.metadata.create_all(bind=engine)
migrate()

app = FastAPI(
    title="Vapor API",
    description="B2B carbon/ESG tracking — forecast, simulate, roadmap, report",
    version="0.2.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
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
