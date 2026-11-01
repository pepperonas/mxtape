from datetime import timedelta

from app import db as app_db
from app.api.wishes import WISH_KEEP_DAYS, WISHES_PER_DAY, wish_key
from app.db import SongWish, utcnow
from tests.conftest import login
from tests.test_songs import _boss, _player


def _wish(client, me, artist="ABBA", title="Waterloo", note=""):
    return client.post("/api/songs/wishes", json={"artist": artist, "title": title, "note": note}, headers={"X-CSRF-Token": me["csrf"]})


def test_key_forgives_spelling():
    assert wish_key("The Beatles", "Let It Be") == wish_key("beatles", "let it be!")
    assert wish_key("Die Ärzte", "Schrei nach Liebe") == wish_key("Arzte", "Schrei  nach liebe")
    assert wish_key("ABBA", "Waterloo") != wish_key("ABBA", "SOS")


def test_wish_needs_an_approved_account_csrf_and_both_fields(client, google):
    me = login(client, google, sub="x", email="x@example.com")
    assert _wish(client, me).status_code == 403
    me = _player(client, google)
    assert client.post("/api/songs/wishes", json={"artist": "ABBA", "title": "Waterloo"}).status_code == 403
    assert _wish(client, me, artist="  ").status_code == 400
    assert _wish(client, me, title="!!!").status_code == 400
    assert _wish(client, me, note="  bitte   ").status_code == 202


def test_admin_sees_wishes_grouped_and_decides(client, google, monkeypatch):
    sent = []
    monkeypatch.setattr("app.mail.notify_song_wish", lambda *a: sent.append(a))
    me = _player(client, google)
    _wish(client, me, note="für die Party")
    _wish(client, me, artist="abba", title="waterloo")  # same person, same song: one wish
    _wish(client, me, artist="Nena", title="99 Luftballons")
    client.cookies.clear()
    other = login(client, google, sub="p2", email="p2@example.com", name="Tom")
    client.cookies.clear()
    boss = _boss(client, google)
    client.post(f"/api/admin/users/{other['id']}/approve", headers={"X-CSRF-Token": boss["csrf"]})
    client.cookies.clear()
    other = login(client, google, sub="p2", email="p2@example.com", name="Tom")
    _wish(client, other, artist="ABBA", title="Waterloo!")
    # One mail per song, for the first wish
    assert [a[1] for a in sent] == ["Waterloo", "99 Luftballons"]
    assert client.get("/api/admin/wishes").status_code == 404
    client.cookies.clear()
    boss = _boss(client, google)
    out = client.get("/api/admin/wishes").json()["wishes"]
    assert [(w["title"], w["count"]) for w in out] == [("Waterloo", 2), ("99 Luftballons", 1)]
    assert out[0]["by"] == ["Lisa", "Tom"]
    assert out[0]["notes"] == [{"by": "Lisa", "text": "für die Party"}]
    h = {"X-CSRF-Token": boss["csrf"]}
    assert client.post("/api/admin/wishes/resolve", json={"key": out[0]["key"], "outcome": "maybe"}, headers=h).status_code == 400
    assert client.post("/api/admin/wishes/resolve", json={"key": out[0]["key"], "outcome": "added"}, headers=h).status_code == 200
    assert client.post("/api/admin/wishes/resolve", json={"key": out[0]["key"], "outcome": "added"}, headers=h).status_code == 404
    assert [w["title"] for w in client.get("/api/admin/wishes").json()["wishes"]] == ["99 Luftballons"]
    # The person sees what became of it
    client.cookies.clear()
    login(client, google, sub="p1", email="p1@example.com", name="Lisa")
    mine = client.get("/api/songs/wishes/mine").json()["wishes"]
    assert {(w["title"], w["status"]) for w in mine} == {("Waterloo", "added"), ("99 Luftballons", "open")}


def test_decided_wishes_go_after_the_keep_time_open_ones_never(client, google):
    me = _player(client, google)
    _wish(client, me, artist="A", title="Old")
    _wish(client, me, artist="B", title="Open")
    with app_db.SessionLocal() as db:
        old = db.query(SongWish).filter_by(title="Old").one()
        old.resolved_at = utcnow() - timedelta(days=WISH_KEEP_DAYS + 1)
        old.outcome = "added"
        db.query(SongWish).filter_by(title="Open").one().created_at = utcnow() - timedelta(days=400)
        db.commit()
    _wish(client, me, artist="C", title="New")
    with app_db.SessionLocal() as db:
        assert sorted(w.title for w in db.query(SongWish).all()) == ["New", "Open"]


def test_deleting_the_account_deletes_its_wishes(client, google):
    me = _player(client, google)
    _wish(client, me)
    assert client.delete("/api/me", headers={"X-CSRF-Token": me["csrf"]}).status_code == 200
    with app_db.SessionLocal() as db:
        assert db.query(SongWish).count() == 0


def test_wishes_are_limited_per_day(client, google):
    me = _player(client, google)
    for i in range(WISHES_PER_DAY):
        assert _wish(client, me, title=f"Song {i}").status_code == 202
    assert _wish(client, me, title="one more").status_code == 429
