"""SQLite (WAL) engine, models and session factory."""

from collections.abc import Generator
from datetime import datetime, timezone

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.types import DateTime

from app.config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


PASSWORD_SUB = "pw:"
STATUSES = ("pending", "approved", "rejected", "blocked")
DOC_KINDS = ("history", "achievements", "settings")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    picture: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # E-mail accounts: scrypt hash; their google_sub is "pw:<random>" until the
    # same address signs in with Google once (then the accounts are one).
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # E-mail accounts only: set once the address is confirmed (Google confirms its own)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Friends may send a mail about their daily round (switch in the profile)
    daily_mail: Mapped[bool] = mapped_column(Boolean, default=True)
    # When this account last mailed friends about a daily round (one per NOTIFY_GAP, whatever the day)
    daily_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def unverified(self) -> bool:
        return self.google_sub.startswith(PASSWORD_SUB) and self.email_verified_at is None


class SessionRow(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserDoc(Base):
    __tablename__ = "user_docs"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    body: Mapped[str] = mapped_column(Text, default="null")
    version: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AdminAction(Base):
    __tablename__ = "admin_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_email: Mapped[str] = mapped_column(String(320))
    target_user_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(32))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


ROOM_STATUSES = ("lobby", "running", "finished", "closed")
MUSIC_MODES = ("room", "everyone")
MAX_SEATS = 10


class Room(Base):
    """A multiplayer round. The host's device runs the game; the server relays
    messages and keeps the latest snapshot, so a restart or a host switching
    devices loses nothing."""

    __tablename__ = "rooms"
    code: Mapped[str] = mapped_column(String(8), primary_key=True)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="lobby", index=True)
    music: Mapped[str] = mapped_column(String(16), default="room")
    options: Mapped[str] = mapped_column(Text, default="{}")
    snapshot: Mapped[str] = mapped_column(Text, default="null")
    rev: Mapped[int] = mapped_column(Integer, default=0)
    # The seat whose device runs the game; another account may take over when
    # the host's device is gone (api/rooms.py takeover)
    host_seat: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RoomMember(Base):
    """A seat in a room: an account (user_id) or a guest (guest_name + token hash)."""

    __tablename__ = "room_members"
    __table_args__ = (UniqueConstraint("room_code", "seat"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_code: Mapped[str] = mapped_column(ForeignKey("rooms.code", ondelete="CASCADE"), index=True)
    seat: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(40))
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Left a running round on purpose: out for the rest of it, the seat stays for the results
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # A screen (TV, laptop) that shows the round and may play the music, but does not play
    display: Mapped[bool] = mapped_column(Integer, default=0)


class Friendship(Base):
    """One row per pair (user_a < user_b); pending until the other side accepts."""

    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_a", "user_b"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_a: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    requested_by: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RoomInvite(Base):
    __tablename__ = "room_invites"
    __table_args__ = (UniqueConstraint("room_code", "to_user"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_code: Mapped[str] = mapped_column(ForeignKey("rooms.code", ondelete="CASCADE"), index=True)
    from_user: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


REPORT_REASONS = ("year", "version", "audio", "cover", "other")


class SongReport(Base):
    """Someone says a song is wrong (year, version, sound, cover)."""

    __tablename__ = "song_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_id: Mapped[str] = mapped_column(String(16), index=True)
    reason: Mapped[str] = mapped_column(String(16))
    note: Mapped[str] = mapped_column(String(300), default="")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SongWish(Base):
    """Someone misses a song: artist + title as typed, for the admin to add.

    `key` groups the same wish from several people (lowercase, accents and
    punctuation gone). Done wishes are deleted after WISH_KEEP_DAYS."""

    __tablename__ = "song_wishes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(240), index=True)
    artist: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(120))
    note: Mapped[str] = mapped_column(String(200), default="")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)


class SongOverride(Base):
    """A correction made in the admin area: applies to every round at once,
    without a new build (the bundled song list stays the default)."""

    __tablename__ = "song_overrides"
    song_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blocked: Mapped[bool] = mapped_column(Integer, default=0)
    admin_email: Mapped[str] = mapped_column(String(320), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivityDay(Base):
    """An approved account used the app on this day (Europe/Berlin) — nothing
    more: no time, no content. For the admin's usage chart; kept 400 days."""

    __tablename__ = "activity_days"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True, index=True)


class AchievementScore(Base):
    """The account holder's achievement points, so friends can compare.
    Written by the device from the account's own achievements document."""

    __tablename__ = "achievement_scores"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    unlocked: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailySet(Base):
    """The songs of one day's round, fixed by the first start that day: every
    later start — any device, any app version — plays exactly these, in this
    order (a catalogue update during the day must not reshuffle the round)."""

    __tablename__ = "daily_sets"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    song_ids: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailyResult(Base):
    """Today's round ("Tagesrunde"): the same songs for everyone, one try a day.

    Since 0.19 a row is the run itself: created on start, advanced song by
    song (``turns``, ``score`` = the streak), finished at the first wrong card
    or after the last song. Rows from before have no ``started_at`` and count
    as finished (their ``total`` was 10).
    """

    __tablename__ = "daily_results"
    __table_args__ = (UniqueConstraint("user_id", "day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    turns: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def finished(self) -> bool:
        return self.started_at is None or self.finished_at is not None


def _configure_sqlite(dbapi_connection, _record) -> None:
    cur = dbapi_connection.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.close()


def make_engine():
    path = get_settings().db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    eng = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    event.listen(eng, "connect", _configure_sqlite)
    return eng


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """create_all never alters an existing table: add columns that came later."""
    later = {
        "room_members": {"left_at": "DATETIME", "display": "INTEGER NOT NULL DEFAULT 0"},
        "rooms": {"host_seat": "INTEGER NOT NULL DEFAULT 0"},
        "users": {"password_hash": "VARCHAR(200)", "email_verified_at": "DATETIME", "daily_mail": "BOOLEAN NOT NULL DEFAULT 1", "daily_notified_at": "DATETIME"},
        "daily_results": {"turns": "INTEGER NOT NULL DEFAULT 0", "started_at": "DATETIME", "finished_at": "DATETIME", "notified_at": "DATETIME"},
    }
    with engine.begin() as conn:
        for table, columns in later.items():
            have = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            for name, kind in columns.items():
                if name not in have:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def as_utc(dt: datetime) -> datetime:
    """SQLite hands back naive datetimes; everything stored is UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
