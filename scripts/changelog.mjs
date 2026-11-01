#!/usr/bin/env node
/**
 * Writes the changelog from git: every release commit
 * ("feat: v0.29.0 — next song loaded ahead, …") becomes one entry.
 *
 *   CHANGELOG.md                  for the repository
 *   pwa/src/data/changelog.json   for the app (Settings → Version → Changelog)
 *
 * Only the commit subject is published, never the body: bodies carry
 * implementation notes. Every summary passes `assertPublic` first; anything
 * that looks like an address, a path on the server, a key or a password
 * stops the run, so it can never reach the public page.
 *
 * Runs before every build (`pwa` prebuild) and in the deploy script, which
 * commits the two files when they changed — nobody edits them by hand.
 *
 *   node scripts/changelog.mjs           write both files
 *   node scripts/changelog.mjs --check   exit 1 when they are out of date
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MD_PATH = join(ROOT, 'CHANGELOG.md')
export const JSON_PATH = join(ROOT, 'pwa/src/data/changelog.json')

/** Releases older than the first commit with a version in its subject. */
const EARLY = [
  {
    version: '0.4.0',
    date: '2026-10-26',
    type: 'feat',
    summary: 'sign-in with Google and an approval queue, virtual play only, a new design'
  },
  { version: '0.2.0', date: '2026-07-21', type: 'feat', summary: 'Material 3 Expressive redesign' }
]

/** The changelog starts here; older versions belong to the retired card printer. */
export const FIRST = '0.2.0'

/** `type(scope): vX.Y.Z — summary` (also `chore(release): …`). */
const RELEASE = /^(feat|fix|chore|perf|refactor|docs)(?:\([^)]*\))?: v(\d+\.\d+\.\d+) [—–-] (.+)$/

const SECRET_PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an e-mail address'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, 'an IP address'],
  [/(?:^|[\s(])\/(?:opt|root|etc|var|home|Users|srv|tmp)\//, 'a server path'],
  [/\.env\b/, 'an env file'],
  [/googleusercontent|apps\.google/i, 'an OAuth client'],
  [/(?:password|passwd|secret|token|api[_-]?key|bearer)\w*\s*[:=]/i, 'a credential'],
  [/\b(?:sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9]{8,}/, 'an API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b[A-Fa-f0-9]{32,}\b/, 'a long hex string'],
  [/\b[A-Za-z0-9_-]{40,}\b/, 'a long token'],
  [/https?:\/\/[^\s]*@/, 'a URL with credentials'],
  [/claude\.ai\/code|Claude-Session|Co-Authored-By/i, 'a commit trailer']
]

/** Throws when `text` looks like it carries something private. */
export function assertPublic(text, where = 'changelog') {
  for (const [re, what] of SECRET_PATTERNS) {
    if (re.test(text)) throw new Error(`${where}: refusing to publish ${what}: ${JSON.stringify(text)}`)
  }
  return text
}

const cmp = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
  return 0
}

/** Entries from `git log` lines of the form "<date>\t<subject>", newest first. */
export function parseLog(lines) {
  const seen = new Map()
  for (const line of lines) {
    const [date, subject] = line.split('\t')
    const m = RELEASE.exec(subject?.trim() ?? '')
    if (!m) continue
    const [, kind, version, summary] = m
    if (cmp(version, FIRST) > 0) continue // the physical-card era before the redesign
    if (seen.has(version)) continue // the newest commit naming a version is the release
    seen.set(version, { version, date, type: kind === 'fix' ? 'fix' : 'feat', summary: summary.trim() })
  }
  for (const e of EARLY) if (!seen.has(e.version)) seen.set(e.version, e)
  const entries = [...seen.values()].sort((a, b) => cmp(a.version, b.version))
  for (const e of entries) assertPublic(e.summary, `v${e.version}`)
  return entries
}

export function readGitLog(cwd = ROOT) {
  const out = execFileSync('git', ['log', '--format=%ad\t%s', '--date=short'], { cwd, encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

const LABEL = { feat: 'New', fix: 'Fixed' }

export function toMarkdown(entries) {
  const lines = [
    '# Changelog',
    '',
    'All notable changes to mxtape. Generated from the release commits by',
    '`scripts/changelog.mjs` — do not edit by hand. The app shows the same list',
    'under Settings → Version.',
    ''
  ]
  for (const e of entries) {
    lines.push(`## ${e.version} — ${e.date}`, '', `- **${LABEL[e.type] ?? 'Changed'}:** ${e.summary}`, '')
  }
  return lines.join('\n')
}

export const toJson = (entries) => JSON.stringify(entries, null, 2) + '\n'

function main() {
  const check = process.argv.includes('--check')
  let lines
  try {
    lines = readGitLog()
  } catch {
    // no git (e.g. a source tarball): keep what is committed
    if (existsSync(JSON_PATH)) return
    throw new Error('changelog: git is needed to build the changelog')
  }
  const entries = parseLog(lines)
  const md = toMarkdown(entries)
  const json = toJson(entries)
  assertPublic(md, 'CHANGELOG.md')
  const current = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
  if (check) {
    const stale = [MD_PATH, JSON_PATH].filter((p, i) => current(p) !== [md, json][i])
    if (stale.length) {
      console.error(`changelog out of date: ${stale.join(', ')} — run node scripts/changelog.mjs`)
      process.exit(1)
    }
    return
  }
  if (current(MD_PATH) !== md) writeFileSync(MD_PATH, md)
  if (current(JSON_PATH) !== json) writeFileSync(JSON_PATH, json)
  console.log(`changelog: ${entries.length} releases, newest v${entries[0].version}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
