"""Song wishes: a player misses a song and asks for it.

The wish lands in the admin area, grouped when several people want the same
song; the admin adds it with the song tools (scripts/song-management) and
marks the wish done or declined. The person sees what became of it.

Kept: open wishes until they are decided; decided ones WISH_KEEP_DAYS after
the decision (pruned whenever a wish comes in or the list is read).
"""

import re
import unicodedata
from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app import mail
from app.db import SongWish, User, as_utc, get_db, utcnow
from app.security import check_limit, err, require_admin, require_approved, require_csrf

router = APIRouter()

WISH_KEEP_DAYS = 90
WISHES_PER_DAY = 20
OUTCOMES = ("added", "declined")
MINE_LIMIT = 30


def wish_key(artist: str, title: str) -> str:
    """One key for the same song typed in different ways."""

    def norm(text: str) -> str:
        text = unicodedata.normalize("NFKD", text.lower())
        text = "".join(c for c in text if not unicodedata.combining(c))
        text = re.sub(r"[^a-z0-9]+", " ", text).strip()
        return re.sub(r"^(the|die|der|das) ", "", text)

    return f"{norm(artist)}|{norm(title)}"[:240]


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


def _prune(db: Session) -> None:
    cutoff = utcnow() - timedelta(days=WISH_KEEP_DAYS)
    db.execute(delete(SongWish).where(SongWish.resolved_at.is_not(None), SongWish.resolved_at < cutoff))


class WishIn(BaseModel):
    artist: str = Field(max_length=200)
    title: str = Field(max_length=200)
    note: str = Field(default="", max_length=400)


@router.post("/api/songs/wishes", status_code=202, dependencies=[Depends(require_csrf)])
def wish(body: WishIn, user: User = Depends(require_approved), db: Session = Depends(get_db)) -> dict:
    artist, title, note = _clean(body.artist, 100), _clean(body.title, 120), _clean(body.note, 200)
    if not artist or not title:
        raise err(400, "missing", "Interpret und Titel fehlen.")
    key = wish_key(artist, title)
    if key.startswith("|") or key.endswith("|"):
        raise err(400, "missing", "Interpret und Titel fehlen.")
    check_limit(f"wish:{user.id}", WISHES_PER_DAY, 86400)
    _prune(db)
    # The same person wishing the same song twice is one wish
    mine = db.execute(
        select(SongWish).where(SongWish.key == key, SongWish.user_id == user.id, SongWish.resolved_at.is_(None))
    ).scalar_one_or_none()
    if mine:
        if note:
            mine.note = note
    else:
        first = db.execute(select(SongWish.id).where(SongWish.key == key, SongWish.resolved_at.is_(None)).limit(1)).first() is None
        db.add(SongWish(key=key, artist=artist, title=title, note=note, user_id=user.id))
        if first:
            mail.notify_song_wish(artist, title, note, user.name or user.email)
    db.commit()
    return {"ok": True}


@router.get("/api/songs/wishes/mine")
def mine(user: User = Depends(require_approved), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(SongWish).where(SongWish.user_id == user.id).order_by(SongWish.created_at.desc()).limit(MINE_LIMIT)
    ).scalars()
    return {
        "wishes": [
            {
                "id": w.id,
                "artist": w.artist,
                "title": w.title,
                "at": as_utc(w.created_at).isoformat(),
                "status": w.outcome or "open",
            }
            for w in rows
        ]
    }


# ── Admin ──────────────────────────────────────────────────────────────────

admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@admin.get("/wishes")
def list_wishes(db: Session = Depends(get_db)) -> dict:
    _prune(db)
    db.commit()
    rows = db.execute(
        select(SongWish, User.name, User.email)
        .join(User, User.id == SongWish.user_id)
        .where(SongWish.resolved_at.is_(None))
        .order_by(SongWish.created_at.asc())
    ).all()
    songs: dict[str, dict] = {}
    for w, name, email in rows:
        s = songs.setdefault(w.key, {"key": w.key, "artist": w.artist, "title": w.title, "count": 0, "by": [], "notes": [], "latest": ""})
        s["count"] += 1
        s["by"].append(name or email)
        if w.note:
            s["notes"].append({"by": name or email, "text": w.note})
        s["latest"] = max(s["latest"], as_utc(w.created_at).isoformat())
    out = sorted(songs.values(), key=lambda s: s["latest"], reverse=True)
    out.sort(key=lambda s: -s["count"])
    return {"wishes": out}


class ResolveIn(BaseModel):
    key: str = Field(max_length=240)
    outcome: str


@admin.post("/wishes/resolve", dependencies=[Depends(require_csrf)])
def resolve(body: ResolveIn, db: Session = Depends(get_db)) -> dict:
    if body.outcome not in OUTCOMES:
        raise err(400, "bad_outcome", "Unbekannte Entscheidung.")
    done = db.execute(
        update(SongWish)
        .where(SongWish.key == body.key, SongWish.resolved_at.is_(None))
        .values(resolved_at=utcnow(), outcome=body.outcome)
    ).rowcount
    db.commit()
    if not done:
        raise err(404, "not_found", "Kein offener Wunsch.")
    return {"ok": True}
