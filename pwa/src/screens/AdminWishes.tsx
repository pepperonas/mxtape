/**
 * Song wishes (admin): songs players miss, grouped when several people want
 * the same one, most wanted first. Adding a song stays with the song tools
 * (scripts/song-management/add-song.js); here the wish is marked added or
 * declined, and the people who asked see that in the song library.
 */
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { api } from '@/api/client'
import { useUI } from '@/contexts'
import { Icon } from '@/components/ui/Icon'
import { spring } from '@/motion/springs'
import { useMessages } from '@/i18n'
import { adminText } from '@/i18n/messages/admin'
import { apiErrorText } from '@/i18n/messages/errors'
import { copyText } from '@/utils/copySong'

export interface WishGroup {
  key: string
  artist: string
  title: string
  count: number
  by: string[]
  notes: { by: string; text: string }[]
  latest: string
}

export function useWishCount(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    api<{ wishes: WishGroup[] }>('/api/admin/wishes')
      .then((r) => setN(r.wishes.length))
      .catch(() => setN(0))
  }, [])
  return n
}

/** The command that adds the song (shell-quoted). */
export function addSongCommand(w: Pick<WishGroup, 'artist' | 'title'>): string {
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  return `node scripts/song-management/add-song.js ${q(w.artist)} ${q(w.title)}`
}

export function AdminWishes({ onCount }: { onCount?: (n: number) => void }) {
  const t = useMessages(adminText)
  const { addToast } = useUI()
  const [wishes, setWishes] = useState<WishGroup[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ wishes: WishGroup[] }>('/api/admin/wishes')
      setWishes(res.wishes)
      onCount?.(res.wishes.length)
      setError(false)
    } catch {
      setError(true)
    }
  }, [onCount])

  useEffect(() => {
    void load()
  }, [load])

  const decide = useCallback(
    async (w: WishGroup, outcome: 'added' | 'declined') => {
      try {
        await api('/api/admin/wishes/resolve', { method: 'POST', json: { key: w.key, outcome } })
        setWishes((list) => {
          const next = list?.filter((x) => x.key !== w.key) ?? null
          onCount?.(next?.length ?? 0)
          return next
        })
        addToast(outcome === 'added' ? t.wishAdded(w.title) : t.wishDeclined(w.title), 'success')
      } catch (e) {
        addToast(apiErrorText(e), 'error')
      }
    },
    [addToast, onCount, t]
  )

  if (error) {
    return (
      <div className="surface p-6 text-center">
        <p className="text-body-lg">{t.loadFailed}</p>
        <button type="button" className="btn btn-tonal m3-state-layer mt-4" onClick={() => void load()}>
          {t.reload}
        </button>
      </div>
    )
  }
  if (!wishes)
    return (
      <div className="m3-loading mx-auto mt-10" aria-label={t.loading}>
        <span className="m3-loading-arc" />
      </div>
    )

  if (wishes.length === 0)
    return (
      <div className="py-12 text-center">
        <Icon name="check" size={40} className="mx-auto text-md-on-surface-variant" />
        <p className="mt-4 text-title-md">{t.wishesEmptyTitle}</p>
        <p className="mt-1 meta max-w-[32ch] mx-auto">{t.wishesEmptyText}</p>
      </div>
    )

  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false} mode="popLayout">
        {wishes.map((w) => (
          <m.li
            key={w.key}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 60, scale: 0.96, transition: spring.effectsDefault }}
            transition={spring.spatialDefault}
            className="surface p-4"
            data-wish
          >
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-md-tertiary-container text-md-on-tertiary-container">
                <Icon name="note" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-title-md break-words">{w.title}</p>
                <p className="text-body-md text-md-on-surface-variant break-words">{w.artist}</p>
                <p className="mt-1 text-label-lg">
                  {t.wishesCount(w.count)}
                  <span className="ml-2 text-label-md text-md-on-surface-variant">{w.by.join(', ')}</span>
                </p>
                {w.notes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {w.notes.map((n, i) => (
                      <li key={i} className="text-body-sm">
                        <span className="text-md-on-surface-variant">{n.by}: </span>„{n.text}“
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-text m3-state-layer"
                onClick={() => void copyText(addSongCommand(w)).then((ok) => addToast(ok ? t.commandCopied : t.copyFailed, ok ? 'success' : 'error'))}
              >
                <Icon name="copy" size={20} />
                {t.copyCommand}
              </button>
              <button type="button" className="btn btn-text m3-state-layer" onClick={() => void decide(w, 'declined')}>
                <Icon name="close" size={20} />
                {t.decline}
              </button>
              <button type="button" className="btn btn-tonal m3-state-layer" onClick={() => void decide(w, 'added')}>
                <Icon name="check" size={20} />
                {t.markAdded}
              </button>
            </div>
          </m.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
