"""The gift is account-bound; provisioning preserves existing player data."""
from sqlalchemy import select

from app.api.auth import user_payload
from app.config import get_settings
from app.db import SessionLocal, SessionRow, UserDoc
from app.passwords import verify_password
from app.provision_account import provision_account
from app.security import create_session


def test_provision_ready_to_play(client, monkeypatch, mails):
    monkeypatch.setattr(get_settings(), "mxtape_martin_edition_email", "gift@example.com")
    with SessionLocal.begin() as db:
        u = provision_account(db, "Gift@Example.com", "Martin", "test-gift-password")
        assert not u.unverified
        assert verify_password("test-gift-password", u.password_hash)
        assert user_payload(u, "csrf")["edition"] == "martin"
    r = client.post("/api/auth/password-login", json={"email": "gift@example.com", "password": "test-gift-password"})
    assert r.status_code == 200
    me = client.get("/api/session").json()["me"]
    assert me["status"] == "approved" and not me["isAdmin"] and me["edition"] == "martin"
    assert client.get("/api/auth/audio-check").status_code == 204
    assert not mails


def test_existing_data_kept_and_sessions_revoked(client):
    with SessionLocal.begin() as db:
        u = provision_account(db, "gift@example.com", "Old", "old-test-password")
        uid = u.id
        db.add(UserDoc(user_id=uid, kind="settings", body='{"theme":"light"}', version=7))
        create_session(db, u)
    with SessionLocal.begin() as db:
        u = provision_account(db, "GIFT@example.com", "Martin", "new-test-password")
        assert u.id == uid and u.name == "Martin"
        assert verify_password("new-test-password", u.password_hash)
        assert not verify_password("old-test-password", u.password_hash)
        assert db.scalar(select(UserDoc).where(UserDoc.user_id == uid)).version == 7
        assert db.scalar(select(SessionRow).where(SessionRow.user_id == uid)) is None


def test_edition_not_from_name_or_pending_status(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "mxtape_martin_edition_email", " GIFT@example.com ")
    with SessionLocal.begin() as db:
        u = provision_account(db, "other@example.com", "Martin", "test-gift-password")
        assert user_payload(u, "csrf")["edition"] is None
        u.email = "gift@example.com"
        u.status = "pending"
        assert user_payload(u, "csrf")["edition"] is None
        u.status = "approved"
        monkeypatch.setattr(get_settings(), "mxtape_martin_edition_email", "")
        assert user_payload(u, "csrf")["edition"] is None
