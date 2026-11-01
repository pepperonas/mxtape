"""Google login, logout, /me and the nginx audio gate."""

import logging
import secrets

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import google_oauth, mail
from app.activity import note_activity
from app.api.rooms import GUEST_COOKIE, guest_may_listen
from app.config import get_settings
from app.db import PASSWORD_SUB, SessionRow, User, get_db, utcnow
from app.security import (
    STATE_COOKIE,
    check_ip_limit,
    clear_session_cookie,
    create_session,
    current_session,
    current_user,
    err,
    is_admin_email,
    load_session,
    require_csrf,
    set_session_cookie,
    sign_payload,
    unsign_payload,
)

log = logging.getLogger("mxtape.auth")
router = APIRouter(prefix="/api")

STATE_PATH = "/api/auth"


def _home(path: str = "/") -> str:
    return f"{get_settings().public_url.rstrip('/')}{path}"


def user_payload(user: User, csrf: str) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "status": user.status,
        "isAdmin": is_admin_email(user.email),
        "hasPassword": user.password_hash is not None,
        "dailyMail": bool(user.daily_mail),
        "edition": "martin" if (user.status == "approved" and user.email.casefold() == get_settings().mxtape_martin_edition_email.strip().casefold()) else None,
        "csrf": csrf,
    }


def upsert_user(db: Session, *, sub: str, email: str, name: str, picture: str) -> tuple[User, bool]:
    """Create or refresh the account behind a verified Google identity.

    Returns (user, is_new). New accounts start as ``pending`` — except admin
    addresses, which are approved on the spot (and re-approved if ever demoted,
    so the admin can never lock themselves out).
    """
    email = email.lower()
    user = db.execute(select(User).where(User.google_sub == sub)).scalar_one_or_none()
    is_new = user is None
    if user is None:
        # An e-mail account with this address: Google has just confirmed the
        # address, so from now on both ways lead into the same account. It counts
        # as new only if nobody had confirmed it (the admin was never told).
        twin = db.execute(
            select(User).where(User.email == email, User.google_sub.startswith(PASSWORD_SUB)).order_by(User.id)
        ).scalars().first()
        if twin is not None:
            is_new = twin.email_verified_at is None
            if twin.email_verified_at is None:
                # Nobody proved the password belongs to the address owner: a
                # stranger could have registered it to wait for the real owner.
                twin.password_hash = None
                db.execute(delete(SessionRow).where(SessionRow.user_id == twin.id))
            twin.google_sub = sub
            twin.email_verified_at = twin.email_verified_at or utcnow()
            user = twin
    if user is None:
        user = User(google_sub=sub, email=email, status="pending")
        db.add(user)
    user.email = email
    user.name = name or user.name or ""
    user.picture = picture or user.picture or ""
    user.last_login_at = utcnow()
    if is_admin_email(email) and user.status != "approved":
        user.status = "approved"
        user.decided_at = utcnow()
    db.commit()
    return user, is_new


def _finish_login(db: Session, user: User, is_new: bool) -> Response:
    if is_new and user.status == "pending":
        mail.notify_new_request(user.name, user.email)
    if user.status in ("rejected", "blocked"):
        # Still a session, so the client can show *why* nothing happens and offer logout.
        log.info("login of %s user=%s", user.status, user.id)
    row = create_session(db, user)
    resp = RedirectResponse(_home("/"), status_code=303)
    resp.delete_cookie(STATE_COOKIE, path=STATE_PATH)
    set_session_cookie(resp, row)
    log.info("login ok user=%s status=%s", user.id, user.status)
    return resp


@router.get("/auth/login")
def login(request: Request) -> Response:
    check_ip_limit(request, "auth", limit=20, window_s=60)
    if not get_settings().google_client_id:
        raise err(503, "oauth_unconfigured", "Google-Anmeldung ist nicht eingerichtet.")
    state = secrets.token_urlsafe(24)
    verifier, challenge = google_oauth.make_pkce()
    resp = RedirectResponse(google_oauth.build_auth_url(state, challenge), status_code=307)
    resp.set_cookie(
        STATE_COOKIE, sign_payload({"state": state, "verifier": verifier}),
        max_age=600, httponly=True, samesite="lax", secure=get_settings().is_prod, path=STATE_PATH,
    )
    return resp


@router.get("/auth/callback")
def callback(request: Request, code: str = "", state: str = "", error: str = "",
             db: Session = Depends(get_db)) -> Response:
    check_ip_limit(request, "auth", limit=20, window_s=60)

    def fail(reason: str) -> Response:
        log.info("oauth callback rejected: %s", reason)
        resp = RedirectResponse(_home(f"/?login_error={reason}"), status_code=303)
        resp.delete_cookie(STATE_COOKIE, path=STATE_PATH)
        return resp

    if error or not code or not state:
        return fail("cancelled")
    stashed = unsign_payload(request.cookies.get(STATE_COOKIE, ""))
    if not stashed or not secrets.compare_digest(str(stashed.get("state", "")), state):
        return fail("state_mismatch")
    try:
        tokens = google_oauth.exchange_code(code, stashed["verifier"])
    except Exception:
        log.exception("token exchange failed")
        return fail("exchange_failed")
    claims = google_oauth.parse_id_token(tokens.get("id_token", ""))
    if claims is None:
        return fail("invalid_token")
    user, is_new = upsert_user(db, sub=str(claims["sub"]), email=str(claims["email"]),
                               name=str(claims.get("name", "")), picture=str(claims.get("picture", "")))
    return _finish_login(db, user, is_new)


@router.get("/auth/dev-login")
def dev_login(email: str = "dev@example.com", name: str = "Dev", db: Session = Depends(get_db)) -> Response:
    """Local development only: log in as any address without Google."""
    s = get_settings()
    if s.is_prod or not s.mx_dev_login:
        raise err(404, "not_found", "Nicht gefunden.")
    user, is_new = upsert_user(db, sub=f"dev:{email.lower()}", email=email, name=name, picture="")
    return _finish_login(db, user, is_new)


@router.post("/auth/logout", dependencies=[Depends(require_csrf)])
def logout(response: Response, row: SessionRow = Depends(current_session), db: Session = Depends(get_db)) -> dict:
    db.delete(row)
    db.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.delete("/me", dependencies=[Depends(require_csrf)])
def delete_me(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Delete the account and everything attached to it: sessions, saved data,
    friendships, invitations and the rooms this account hosts.

    Rejected and blocked accounts cannot delete themselves: the row holds the
    decision, and deleting it would let the next sign-in start a fresh request.
    They are deleted on request (see the privacy policy)."""
    if user.status in ("rejected", "blocked"):
        raise err(403, "decision_kept", "Dieses Konto kann nur auf Anfrage gelöscht werden.")
    log.info("account deleted: user %s", user.id)
    db.delete(user)
    db.commit()
    clear_session_cookie(response)
    return {"ok": True}


class PrefsIn(BaseModel):
    dailyMail: bool


@router.put("/me/prefs", dependencies=[Depends(require_csrf)])
def set_prefs(body: PrefsIn, row: SessionRow = Depends(current_session), user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Personal switches kept on the account (mails from friends about their daily round)."""
    user.daily_mail = body.dailyMail
    db.commit()
    return user_payload(user, row.csrf_token)


@router.get("/me")
def me(row: SessionRow = Depends(current_session), user: User = Depends(current_user)) -> dict:
    return user_payload(user, row.csrf_token)


@router.get("/session")
def session(request: Request, db: Session = Depends(get_db)) -> dict:
    """Like /me, but 200 with ``me: null`` when signed out (no console noise on the login page)."""
    row = load_session(request, db)
    user = db.get(User, row.user_id) if row else None
    if user and row:
        note_activity(db, user)
    return {"me": user_payload(user, row.csrf_token) if user and row else None}


@router.get("/auth/audio-check")
def audio_check(request: Request, db: Session = Depends(get_db)) -> Response:
    """nginx ``auth_request`` target for /audio/: 204 for approved sessions and
    for guests of a room that is still open (lobby or running), else 401."""
    row = load_session(request, db)
    if row is not None:
        user = db.get(User, row.user_id)
        if user is not None and user.status == "approved":
            return Response(status_code=204)
    if guest_may_listen(db, request.cookies.get(GUEST_COOKIE)):
        return Response(status_code=204)
    return Response(status_code=401)
