"""mxtape API: Google or e-mail login with an approval queue, per-account data, audio gate."""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api import achievements, admin, admin_stats, auth, daily, data, friends, password_auth, rooms, songs, stats, wishes
from app.config import get_settings
from app.api.rooms import purge_expired
from app.db import SessionLocal, init_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def create_app() -> FastAPI:
    s = get_settings()
    if s.is_prod and len(s.session_secret) < 32:
        raise RuntimeError("SESSION_SECRET must be at least 32 characters in production")
    if s.is_prod and s.mx_dev_login:
        raise RuntimeError("MX_DEV_LOGIN must never be enabled in production")
    init_db()
    with SessionLocal() as db:
        purge_expired(db)
        password_auth.purge_unverified(db)
    app = FastAPI(title="mxtape", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
        return JSONResponse(detail, status_code=exc.status_code)

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True}

    app.include_router(auth.router)
    app.include_router(password_auth.router)
    app.include_router(admin.router)
    app.include_router(data.router)
    app.include_router(rooms.router)
    app.include_router(friends.router)
    app.include_router(songs.router)
    app.include_router(songs.admin)
    app.include_router(wishes.router)
    app.include_router(wishes.admin)
    app.include_router(daily.router)
    app.include_router(achievements.router)
    app.include_router(admin_stats.router)
    app.include_router(stats.router)
    return app


app = create_app()
