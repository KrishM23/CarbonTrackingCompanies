"""
Netlify Function entrypoint for the Vapor FastAPI app.
Browser calls /api/* → redirected here.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Vendored during Netlify build: netlify/functions/app  (copy of backend/app)
sys.path.insert(0, str(HERE))

os.environ.setdefault("NETLIFY", "true")
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/vapor.db"
os.environ.setdefault("CORS_ORIGINS", "*")
os.environ.setdefault("SEED_ON_START", "1")

from mangum import Mangum  # noqa: E402
from app.main import app  # noqa: E402


def handler(event, context):
    """Normalize path so FastAPI sees /api/... routes."""
    path = event.get("path") or event.get("rawPath") or "/"
    if path.startswith("/.netlify/functions/api"):
        path = path[len("/.netlify/functions/api") :] or "/"
    if not path.startswith("/"):
        path = "/" + path
    if not path.startswith("/api"):
        path = "/api" + path
    event = dict(event)
    event["path"] = path
    event["rawPath"] = path
    rc = event.get("requestContext")
    if isinstance(rc, dict):
        rc = dict(rc)
        http = rc.get("http")
        if isinstance(http, dict):
            rc["http"] = {**http, "path": path}
        event["requestContext"] = rc
    return Mangum(app, lifespan="off")(event, context)
