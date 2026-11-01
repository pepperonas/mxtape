/**
 * Changelog — every release, newest first, in English whatever the app's
 * language (Settings → Version). The list is written from the release commits
 * by scripts/changelog.mjs before every build; nobody edits it by hand.
 */
import { SubPageHeader } from '@/shell/AppShell'
import { useMessages } from '@/i18n'
import { profileText } from '@/i18n/messages/profile'
import { VERSION } from './ProfileScreen'
import releases from '@/data/changelog.json'

export interface Release {
  version: string
  date: string
  type: 'feat' | 'fix'
  summary: string
}

export const RELEASES = releases as Release[]

/** Dates in English too, whatever the app's language („1 Nov 2026“, never „heute“). */
export const releaseDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function ChangelogScreen() {
  const t = useMessages(profileText)
  return (
    <div>
      <SubPageHeader title={t.changelog} back="/settings" />
      <p className="meta mt-2 mb-4 px-1" lang="en">
        Every release of mxtape, newest first. Written automatically from the release notes.
      </p>
      <ol className="surface overflow-hidden divide-y divide-md-outline-variant/40" lang="en" data-changelog>
        {RELEASES.map((r) => (
          <li key={r.version} className="px-4 py-3 flex gap-4 items-start" data-release={r.version}>
            <span className="w-16 shrink-0 num-poster text-title-md tabular">{r.version}</span>
            <span className="flex-1 min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`chip !min-h-0 !py-0.5 !px-2 text-label-md ${
                    r.type === 'fix' ? 'bg-md-secondary-container text-md-on-secondary-container' : 'bg-md-primary-container text-md-on-primary-container'
                  }`}
                >
                  {r.type === 'fix' ? 'Fixed' : 'New'}
                </span>
                {r.version === VERSION && <span className="text-label-md text-md-primary">Current</span>}
                <span className="meta">{releaseDate(r.date)}</span>
              </span>
              <span className="block text-body-lg mt-1">{capital(r.summary)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
