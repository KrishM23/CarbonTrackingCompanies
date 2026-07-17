# CarbonTrack

B2B SaaS carbon/ESG tracking for mid-size companies. Adapted from **[Revitalize](../Carbon%20Trackers)** (UC campus emissions tracker): same 5-model ensemble forecasting with LOOCV prediction intervals, coupled what-if scenario simulator, and dashboard charts — re-scoped to a single company per account.

## MVP scope

- One company per account (signup creates user + company)
- Manual + CSV Scope 1–3 data entry
- Custom reduction target (baseline year, target year, % cut)
- Forecast vs. target with ensemble models + 95% intervals
- What-if simulator: electrification, cleaner electricity, travel reduction
- PDF progress report export
- Basic JWT auth
- **No billing** yet

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript + Recharts |
| Backend | FastAPI |
| Engine | Python port of Revitalize `forecast.js` / `scenarios.js` |
| DB | Postgres (Docker) or SQLite (local default) |
| Auth | JWT + bcrypt |

## Quick start (local, SQLite)

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # demo@acme.corp / demo1234
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with `demo@acme.corp` / `demo1234`.

> **Note:** The API runs on **port 8002** by default in local scripts (8001/8000 may be occupied by other projects). Vite proxies `/api` → `127.0.0.1:8002`.

For Postgres locally (optional): `pip install -r requirements-postgres.txt` and set `DATABASE_URL=postgresql://carbon:carbon@localhost:5432/carbontrack`.

```bash
# Backend (recommended local command)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

## Docker (Postgres)

```bash
docker compose up --build
```

- App: http://localhost:5173  
- API docs: http://localhost:8002/docs  

## CSV format

```csv
year,scope1,scope2,scope3,notes
2019,42000,18500,31000,Baseline
2024,36500,12800,24800,Latest
```

A sample file is at `frontend/public/sample-emissions.csv`.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create user + company |
| POST | `/api/auth/login` | Get JWT |
| GET | `/api/auth/me` | Current user + company |
| GET/PATCH | `/api/company` | Company profile & target |
| GET/POST | `/api/emissions` | List / upsert year |
| POST | `/api/emissions/csv` | CSV import |
| GET | `/api/dashboard` | Metrics + forecast |
| POST | `/api/scenarios/run` | What-if simulation |
| GET | `/api/reports/pdf` | Download PDF report |

## Engine notes

Ported from Revitalize:

- **Forecast**: OLS, recency-weighted OLS, polynomial, log-linear, Holt / damped Holt, ridge — LOOCV-weighted ensemble with distance-aware 95% prediction intervals
- **Scenarios (v2.1)**: scope levers with electrification load shift (λ), soft diminishing returns (β), logistic capital ramp (κ), pairing synergy (σ)

Company policy replaces UC 2045 / 90% defaults: each company sets its own baseline year, target year, and reduction %.

## Project layout

```
backend/
  app/
    engine/          # forecast + scenarios + analytics
    routers/         # auth, company, emissions, analytics, reports
    models.py
    seed.py
frontend/
  src/
    pages/           # dashboard, data, simulator, settings, auth
    components/
docker-compose.yml
```

## Disclaimer

Inventory figures are company-entered. CarbonTrack does not independently verify emissions data. Forecasting and scenario outputs are decision-support estimates, not audited climate disclosures.
