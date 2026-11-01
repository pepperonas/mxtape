"""Operator-only account provisioning. No HTTP endpoint and no mail.

Run as the API service user: python -m app.provision_account EMAIL --name NAME
The password is prompted without echo, or read from stdin with --password-stdin.
"""
import argparse
import getpass
import secrets
import sys

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import PASSWORD_SUB, SessionLocal, SessionRow, User, init_db, utcnow
from app.passwords import MAX_LEN, MIN_LEN, hash_password


def provision_account(db: Session, email: str, name: str, password: str) -> User:
    email = email.strip().lower()
    name = name.strip()
    if not email or "@" not in email or not name:
        raise ValueError("A valid email and non-empty name are required")
    if not MIN_LEN <= len(password) <= MAX_LEN:
        raise ValueError(f"Password must be {MIN_LEN}–{MAX_LEN} characters")
    # one_or_none deliberately refuses ambiguous legacy duplicate addresses.
    user = db.scalars(select(User).where(func.lower(User.email) == email)).one_or_none()
    if user is None:
        user = User(email=email, name=name, google_sub=PASSWORD_SUB + secrets.token_urlsafe(24))
        db.add(user)
        db.flush()
    else:
        db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    user.name = name
    user.password_hash = hash_password(password)
    user.email_verified_at = utcnow()
    user.status = "approved"
    user.decided_at = utcnow()
    db.flush()
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("--name", required=True)
    parser.add_argument("--password-stdin", action="store_true")
    args = parser.parse_args()
    password = sys.stdin.readline().rstrip("\r\n") if args.password_stdin else getpass.getpass("Password: ")
    init_db()
    with SessionLocal.begin() as db:
        user = provision_account(db, args.email, args.name, password)
        print(f"Approved account ready: id={user.id}, email={user.email}")


if __name__ == "__main__":
    main()
