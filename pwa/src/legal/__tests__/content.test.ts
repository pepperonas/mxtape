/**
 * The privacy policy makes promises about cookies, lifetimes and deletion.
 * These tests tie each promise to the code that keeps it, so changing the
 * code without the text (or the other way round) fails here.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { LEGAL } from '../content'
import { GAME_CONFIG } from '@/utils/constants'

const ROOT = join(__dirname, '../../../..')
const server = (file: string) => readFileSync(join(ROOT, 'server/app', file), 'utf8')
const text = (lang: 'de' | 'en') =>
  JSON.stringify(LEGAL.privacy[lang].sections)

const num = (src: string, re: RegExp) => {
  const m = re.exec(src)
  if (!m) throw new Error(`not found: ${re}`)
  return m[1]
}

describe('privacy policy matches the code', () => {
  it('names exactly the cookies the server sets', () => {
    const names = [
      num(server('security.py'), /SESSION_COOKIE = "([^"]+)"/),
      num(server('security.py'), /STATE_COOKIE = "([^"]+)"/),
      num(server('api/rooms.py'), /GUEST_COOKIE = "([^"]+)"/),
      num(server('api/password_auth.py'), /KNOWN_COOKIE = "([^"]+)"/)
    ]
    for (const lang of ['de', 'en'] as const) for (const n of names) expect(text(lang)).toContain(n)
  })

  it('states the session lifetime', () => {
    const days = Number(num(server('config.py'), /session_ttl_hours: int = (\d+)/)) / 24
    expect(text('de')).toContain(`(${days} Tage`)
    expect(text('en')).toContain(`(${days} days`)
  })

  it('states the guest cookie lifetime', () => {
    const hours = Number(num(server('api/rooms.py'), /GUEST_COOKIE_MAX_AGE = (\d+) \* 3600/))
    expect(text('de')).toContain(`(${hours} Stunden`)
    expect(text('en')).toContain(`(valid for ${hours} hours`)
  })

  it('states when rooms are deleted, and the server really deletes them', () => {
    const hours = Number(num(server('api/rooms.py'), /ROOM_TTL = timedelta\(hours=(\d+)\)/))
    expect(text('de')).toContain(`${hours} Stunden nach der letzten Aktivität`)
    expect(text('en')).toContain(`${hours} hours after the last activity`)
    expect(server('api/rooms.py')).toMatch(/delete\(Room\)\.where\(Room\.expires_at < utcnow\(\)\)/)
  })

  it('states when daily rounds are deleted, and the server deletes them', () => {
    const days = Number(num(server('api/daily.py'), /KEEP_DAYS = (\d+)/))
    expect(text('de')).toContain(`nach ${days} Tagen wird alles gelöscht`)
    expect(text('en')).toContain(`deleted after ${days} days`)
    expect(server('api/daily.py')).toMatch(/DailyResult\.day < cutoff\)\.delete\(\)/)
  })

  it('names the mails to friends: once a day, opt-out in the profile — as the server does it', () => {
    expect(text('de')).toContain('höchstens eine solche Mail pro Tag')
    expect(text('de')).toContain('im Profil ab')
    expect(text('en')).toContain('at most one such email goes out per day')
    const api = server('api/daily.py')
    expect(api).toMatch(/if run\.notified_at is not None:\s*\n\s*raise err\(409, "already_sent"/)
    expect(api).toMatch(/User\.daily_mail\.is_\(True\)/)
  })

  it('states when activity days are deleted, and the server deletes them and keeps no time', () => {
    const days = Number(num(server('activity.py'), /KEEP_DAYS = (\d+)/))
    expect(text('de')).toContain(`nach ${days} Tagen gelöscht, mit dem Konto sofort`)
    expect(text('en')).toContain(`deleted after ${days} days, with the account at once`)
    expect(server('activity.py')).toMatch(/delete\(ActivityDay\)\.where\(ActivityDay\.day < cutoff\)/)
    // only the day: the table has no time column, and it goes with the account
    const table = /class ActivityDay[\s\S]*?\n\n\n/.exec(server('db.py'))![0]
    expect(table).toContain('ondelete="CASCADE"')
    expect(table).not.toMatch(/DateTime/)
  })

  it('names song requests: kept until decided, deleted the stated days after, and with the account', () => {
    const days = Number(num(server('api/wishes.py'), /WISH_KEEP_DAYS = (\d+)/))
    expect(text('de')).toContain(`entschiedene lösche ich ${days} Tage danach`)
    expect(text('en')).toContain(`decided ones are deleted ${days} days later`)
    expect(server('api/wishes.py')).toMatch(/SongWish\.resolved_at\.is_not\(None\), SongWish\.resolved_at < cutoff/)
    const table = /class SongWish[\s\S]*?\n\n\n/.exec(server('db.py'))![0]
    expect(table).toContain('ondelete="CASCADE"')
    expect(text('de')).toContain('Songwünsche und deine Räume')
  })

  it('names song reports, and they are deleted with the account', () => {
    expect(server('db.py')).toMatch(/class SongReport[\s\S]*?ForeignKey\("users\.id", ondelete="CASCADE"\)/)
    expect(text('de')).toContain('Meldest du einen Song')
    expect(text('en')).toContain('If you report a song')
  })

  it('promises account deletion, and the API offers it', () => {
    expect(server('api/auth.py')).toMatch(/@router\.delete\("\/me"/)
    expect(text('de')).toContain('ganze Konto löschen')
    expect(text('en')).toContain('the whole account')
  })

  it('states when unconfirmed e-mail sign-ups are deleted, and the server deletes them', () => {
    const hours = Number(num(server('api/password_auth.py'), /VERIFY_TTL = timedelta\(hours=(\d+)\)/))
    expect(text('de')).toContain(`innerhalb von ${hours} Stunden benutzt, lösche ich`)
    expect(text('en')).toContain(`within ${hours} hours, I delete`)
    expect(server('api/password_auth.py')).toMatch(/User\.created_at < cutoff/)
    expect(server('main.py')).toContain('purge_unverified(db)')
  })

  it('states the reset link lifetime and that passwords are only hashed', () => {
    expect(server('api/password_auth.py')).toMatch(/RESET_TTL = timedelta\(hours=1\)/)
    expect(text('de')).toContain('eine Stunde und nur einmal')
    expect(server('passwords.py')).toContain('hashlib.scrypt')
    expect(text('de')).toContain('scrypt')
  })

  it('states how many rounds the history keeps', () => {
    expect(text('de')).toContain(`bis zu ${GAME_CONFIG.MAX_HISTORY_GAMES} Runden`)
    expect(text('en')).toContain(`up to ${GAME_CONFIG.MAX_HISTORY_GAMES} rounds`)
  })
})

describe('legal texts', () => {
  it('have the same structure in both languages', () => {
    for (const kind of ['imprint', 'privacy', 'terms'] as const) {
      expect(LEGAL[kind].en.sections.length).toBe(LEGAL[kind].de.sections.length)
    }
  })
})

describe('the group statistics every player sees', () => {
  it('the text names what is shown, and the server leaves out what the text leaves out', () => {
    const de = text('de')
    expect(de).toContain('„Alle zusammen“')
    expect(de).toContain('ohne Namen, ohne Konten und ohne Uhrzeiten oder Wochentage der Runden')
    expect(text('en')).toContain('no names, no accounts and no times of day or weekdays of the rounds')
    const api = server('api/admin_stats.py')
    // the public totals drop the hours and weekdays of the rounds
    expect(api).toMatch(/def public_stats[\s\S]*?k not in \("hours", "weekdays"\)/)
    // and contain neither accounts, activity nor the community figures
    const publicFn = /def public_stats[\s\S]*?\n\n\n/.exec(api)![0]
    expect(publicFn).not.toMatch(/accounts|activity|social/)
    expect(server('api/stats.py')).toMatch(/Depends\(require_approved\)/)
  })
})
