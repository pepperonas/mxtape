/**
 * The changelog is written from git by scripts/changelog.mjs and shown in the
 * settings. These tests hold three promises: nothing private reaches the page,
 * the file in the repo and the app's list are the same, and the generator is
 * wired so it runs on its own (before every build and in the deploy).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { AppProviders } from '@/contexts'
import { ChangelogScreen, RELEASES, releaseDate } from '@/screens/ChangelogScreen'
import { VERSION } from '@/screens/ProfileScreen'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
interface Gen {
  assertPublic: (t: string, where?: string) => string
  parseLog: (lines: string[]) => { version: string; date: string; type: string; summary: string }[]
  toMarkdown: (e: unknown[]) => string
  toJson: (e: unknown[]) => string
  FIRST: string
}
// @ts-expect-error — a plain .mjs script without types
const gen = () => import('../../../scripts/changelog.mjs') as Promise<Gen>

describe('nothing private is published', () => {
  it('refuses addresses, server paths, keys, passwords and commit trailers', async () => {
    const { assertPublic } = await gen()
    const bad = [
      'mail me at someone@example.com',
      'moved to 69.62.121.168',
      'reads /opt/mxtape-api/.env now',
      'the .env carries it',
      'client 575245359999-abc.apps.googleusercontent.com',
      'SESSION_SECRET=abcdef',
      'password: hunter2',
      'token=xyz',
      'key ghp_abcdefghijklmnop1234',
      'hash 0123456789abcdef0123456789abcdef',
      'eyJhbGciOiJIUzI1NiJ9eyJzdWIiOiIxMjM0NTY3ODkwIn0abcdefgh',
      'https://user:pw@host.example',
      'Claude-Session: https://claude.ai/code/session_x',
      '-----BEGIN OPENSSH PRIVATE KEY-----'
    ]
    for (const t of bad) expect(() => assertPublic(t), t).toThrow(/refusing to publish/)
    // ordinary release notes pass
    for (const t of ['next song loaded ahead, year handicap, song requests', 'audio as AAC (1.3 GB → 790 MB)', 'bots listen 3–6 s; review fixes'])
      expect(assertPublic(t)).toBe(t)
  })

  it('every published line passes the filter, in the repo file and in the app', async () => {
    const { assertPublic } = await gen()
    expect(() => assertPublic(read('CHANGELOG.md'))).not.toThrow()
    for (const r of RELEASES) expect(() => assertPublic(r.summary)).not.toThrow()
  })

  it('a release whose subject carries a secret stops the run instead of being skipped', async () => {
    const { parseLog } = await gen()
    expect(() => parseLog(['2026-11-02\tfix: v0.30.1 — key now in /etc/mxtape.conf'])).toThrow(/server path/)
  })

  it('publishes only subjects — the generator never reads commit bodies', () => {
    const script = read('scripts/changelog.mjs')
    expect(script).toContain("'--format=%ad\\t%s'")
    expect(script).not.toMatch(/%b|%B/)
  })
})

describe('the entries', () => {
  it('come from release subjects, newest commit per version, older card-era versions left out', async () => {
    const { parseLog, FIRST } = await gen()
    const entries = parseLog([
      '2026-11-02\tfix: v0.29.2 — a second try',
      '2026-11-01\tfeat: v0.29.2 — first try',
      '2026-11-01\tfix(security): v0.29.1 — wished songs stay text',
      '2026-11-01\tdocs: README refreshed',
      '2026-10-04\tchore(release): v0.3.0 — motion',
      '2025-10-29\tfeat: v0.0.14 — particles'
    ])
    expect(entries.map((e) => e.version).slice(0, 3)).toEqual(['0.29.2', '0.29.1', '0.4.0'])
    expect(entries[0]).toEqual({ version: '0.29.2', date: '2026-11-02', type: 'fix', summary: 'a second try' })
    expect(entries.find((e) => e.version === '0.3.0')?.type).toBe('feat')
    expect(entries.some((e) => e.version === '0.0.14')).toBe(false)
    expect(entries[entries.length - 1].version).toBe(FIRST)
  })

  it('the repo file and the app list are the same, newest first, the current version not ahead of the app', async () => {
    const { toMarkdown, toJson } = await gen()
    expect(read('CHANGELOG.md')).toBe(toMarkdown(RELEASES))
    expect(read('pwa/src/data/changelog.json')).toBe(toJson(RELEASES))
    const key = (v: string) => v.split('.').map((n) => n.padStart(4, '0')).join('.')
    const versions = RELEASES.map((r) => key(r.version))
    expect([...versions].sort().reverse()).toEqual(versions)
    expect(new Set(versions).size).toBe(versions.length)
    expect(versions[0] <= key(VERSION)).toBe(true)
  })
})

describe('kept automatically', () => {
  it('runs before every build and in the deploy, which commits it when it changed', () => {
    expect(JSON.parse(read('pwa/package.json')).scripts.prebuild).toBe('node ../scripts/changelog.mjs')
    const deploy = read('scripts/deployment/deploy.sh')
    expect(deploy).toContain('node scripts/changelog.mjs')
    expect(deploy).toMatch(/git commit [^\n]*CHANGELOG\.md[^\n]*changelog\.json/)
  })
})

describe('the page', () => {
  it('lists every release in English, marks the current one and links from the settings', () => {
    render(
      <MotionTestProvider>
        <MemoryRouter>
          <AppProviders>
            <ChangelogScreen />
          </AppProviders>
        </MemoryRouter>
      </MotionTestProvider>
    )
    const list = document.querySelector('[data-changelog]')!
    expect(list.getAttribute('lang')).toBe('en')
    expect(list.querySelectorAll('[data-release]').length).toBe(RELEASES.length)
    expect(screen.getAllByText(/^(New|Fixed)$/).length).toBe(RELEASES.length)
    expect(releaseDate('2026-11-01')).toBe('1 Nov 2026')
    expect(list.textContent).toContain(releaseDate(RELEASES[0].date))
    expect(list.textContent).not.toMatch(/heute|gestern|Okt\.|Nov\./)
    if (RELEASES[0].version === VERSION) expect(screen.getByText('Current')).toBeInTheDocument()
    expect(read('pwa/src/screens/ProfileScreen.tsx')).toContain("navigate('/settings/changelog')")
    expect(read('pwa/src/App.tsx')).toContain("{ path: '/settings/changelog', element: <ChangelogScreen /> }")
  })
})
