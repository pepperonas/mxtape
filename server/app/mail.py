"""Outgoing mail: SMTP (implicit TLS) when SMTP_HOST is set, otherwise the
local sendmail binary when SENDMAIL_PATH is set, otherwise a logged no-op
(dev and tests never send anything). Failures are logged, never raised: a lost
notification must not break a login.
"""

import logging
import smtplib
import ssl
import subprocess
import threading
from email.message import EmailMessage

from app.config import get_settings

log = logging.getLogger("mxtape.mail")


def send(to: str, subject: str, text: str) -> bool:
    s = get_settings()
    if not s.smtp_host and not s.sendmail_path:
        log.info("mail disabled, not sent: %r", subject)
        return False
    msg = EmailMessage()
    msg["From"] = s.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    try:
        if s.smtp_host:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ssl.create_default_context(), timeout=20) as smtp:
                smtp.login(s.smtp_user, s.smtp_pass)
                smtp.send_message(msg)
            return True
        subprocess.run([s.sendmail_path, "-t", "-i"], input=msg.as_bytes(), check=True, timeout=30)
        return True
    except Exception:
        log.exception("sendmail failed for %r", subject)
        return False


# Tests switch this off to observe the send synchronously.
BACKGROUND = True


def send_later(to: str, subject: str, text: str) -> None:
    """Fire and forget: a request must not wait for SMTP."""
    if BACKGROUND:
        threading.Thread(target=lambda: send(to, subject, text), daemon=True).start()
    else:
        send(to, subject, text)


def _url(path: str) -> str:
    return f"{get_settings().public_url.rstrip('/')}{path}"


def notify_new_request(name: str, email: str, method: str = "Google") -> None:
    s = get_settings()
    send_later(
        s.notify_email,
        f"mxtape: {name or email} möchte mitspielen",
        f"Neue Anfrage auf mxtape ({method}):\n\n  {name}\n  {email}\n\n"
        f"Freischalten: {_url('/admin')}\n",
    )


def notify_song_report(song_id: str, reason: str, note: str, by: str) -> None:
    """First open report on a song: tell the admin (later ones only count up)."""
    s = get_settings()
    send_later(
        s.notify_email,
        f"mxtape: Song {song_id} gemeldet",
        f"{by} meldet {song_id} ({reason})." + (f"\n\n  „{note}“" if note else "") + f"\n\nAnsehen: {_url('/admin')}\n",
    )


def notify_song_wish(artist: str, title: str, note: str, by: str) -> None:
    """First open wish for a song: tell the admin (later ones only count up)."""
    s = get_settings()
    send_later(
        s.notify_email,
        f"mxtape: Songwunsch {artist} – {title}",
        f"{by} wünscht sich „{title}“ von {artist}." + (f"\n\n  „{note}“" if note else "") + f"\n\nAnsehen: {_url('/admin')}\n",
    )


_SIGN = {"de": "\n\nmxtape\n{url}\n", "en": "\n\nmxtape\n{url}\n"}


def _foot(lang: str) -> str:
    return _SIGN.get(lang, _SIGN["de"]).format(url=_url("/"))


def send_verification(to: str, name: str, link: str, lang: str) -> None:
    if lang == "en":
        subject = "mxtape: confirm your email address"
        text = (f"Hi {name},\n\nplease confirm your email address for mxtape:\n\n{link}\n\n"
                "The link works for 48 hours. After that, Martin approves new accounts one by one — "
                "you will be let in as soon as he has.\n\nIf you did not sign up, ignore this email; "
                "the unconfirmed account is deleted after 48 hours.")
    else:
        subject = "mxtape: bitte bestätige deine E-Mail-Adresse"
        text = (f"Hallo {name},\n\nbitte bestätige deine E-Mail-Adresse für mxtape:\n\n{link}\n\n"
                "Der Link gilt 48 Stunden. Danach schaltet Martin neue Konten einzeln frei — "
                "sobald das passiert ist, bist du drin.\n\nWenn du dich nicht angemeldet hast, ignorier "
                "diese Mail; das unbestätigte Konto wird nach 48 Stunden gelöscht.")
    send_later(to, subject, text + _foot(lang))


def send_already_registered(to: str, google_only: bool, lang: str) -> None:
    """Someone tried to register an address that already has an account."""
    if lang == "en":
        subject = "mxtape: you already have an account"
        how = ("This address signs in with Google — use \"Sign in with Google\"." if google_only
               else "Sign in with your email and password, or use \"Forgot password\" to set a new one.")
        text = f"Hi,\n\nsomeone (probably you) tried to sign up to mxtape with this address, but it already has an account.\n\n{how}\n\nIf that was not you, nothing has changed."
    else:
        subject = "mxtape: du hast schon ein Konto"
        how = ("Diese Adresse meldet sich mit Google an — nimm „Mit Google anmelden“." if google_only
               else "Melde dich mit E-Mail und Passwort an, oder setz über „Passwort vergessen“ ein neues.")
        text = f"Hallo,\n\njemand (vermutlich du) wollte sich mit dieser Adresse bei mxtape registrieren, aber es gibt schon ein Konto.\n\n{how}\n\nWenn du das nicht warst, hat sich nichts geändert."
    send_later(to, subject, text + _foot(lang))


def send_reset(to: str, name: str, link: str | None, lang: str) -> None:
    """``link`` None: the account signs in with Google and has no password."""
    if lang == "en":
        subject = "mxtape: reset your password"
        body = (f"Set a new password here (the link works for one hour, once):\n\n{link}" if link
                else "This address signs in with Google and has no password — use \"Sign in with Google\".")
        text = f"Hi {name},\n\n{body}\n\nIf you did not ask for this, ignore this email; your password stays as it is."
    else:
        subject = "mxtape: Passwort zurücksetzen"
        body = (f"Hier setzt du ein neues Passwort (der Link gilt eine Stunde und nur einmal):\n\n{link}" if link
                else "Diese Adresse meldet sich mit Google an und hat kein Passwort — nimm „Mit Google anmelden“.")
        text = f"Hallo {name},\n\n{body}\n\nWenn du das nicht angefordert hast, ignorier diese Mail; dein Passwort bleibt, wie es ist."
    send_later(to, subject, text + _foot(lang))


def send_daily_challenge(to: str, sender: str, streak: int, songs: int, lang: str) -> None:
    """A friend tells about their daily round (they chose the recipients)."""
    link = _url("/daily")
    profile = _url("/profile")
    if lang == "en":
        subject = f"mxtape: {sender} played today's round"
        result = (f" and got all {songs} songs right" if streak == songs and streak > 0
                  else f" and got a streak of {streak}" if streak > 0 else "")
        text = (f"{sender} just played today's round on mxtape{result}.\n\n"
                f"Can you beat it? Same songs for everyone, until the first card lands wrong:\n\n{link}\n\n"
                f"You get this because {sender} chose to tell you. You can turn these emails off in your profile: {profile}")
    else:
        subject = f"mxtape: {sender} hat die Tagesrunde gespielt"
        result = (f" und alle {songs} Songs richtig gelegt" if streak == songs and streak > 0
                  else f" und eine Serie von {streak} geschafft" if streak > 0 else "")
        text = (f"{sender} hat eben die Tagesrunde in mxtape gespielt{result}.\n\n"
                f"Schaffst du mehr? Dieselben Songs für alle, bis die erste Karte danebenliegt:\n\n{link}\n\n"
                f"Du bekommst diese Mail, weil {sender} dir Bescheid geben wollte. Abbestellen kannst du solche Mails im Profil: {profile}")
    send_later(to, subject, text + _foot(lang))
