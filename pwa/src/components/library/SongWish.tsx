/**
 * Song wishes: a player misses a song and asks for it. The wish lands in the
 * admin area (Verwaltung → Wünsche, grouped when several people want the
 * same song); the player sees under „Deine Wünsche“ what became of it.
 * Approved accounts only — guests in a room have no account to wish from.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useAuthMaybe } from '@/auth/AuthContext'
import { useUI } from '@/contexts'
import { useMessages } from '@/i18n'
import { wishText } from '@/i18n/messages/wishes'
import { apiErrorText } from '@/i18n/messages/errors'
import { Icon } from '@/components/ui/Icon'

export interface MyWish {
  id: number
  artist: string
  title: string
  at: string
  status: 'open' | 'added' | 'declined'
}

/** Approved accounts only. */
export function useMayWish(): boolean {
  const auth = useAuthMaybe()
  return auth?.state.kind === 'signed-in' && auth.state.me.status === 'approved'
}

/** Told whenever a wish was sent (the own list reloads). */
const listeners = new Set<() => void>()
function noteSent() {
  listeners.forEach((fn) => fn())
}

export function SongWishButton({
  prefill,
  label,
  className = 'btn btn-tonal m3-state-layer'
}: {
  prefill?: { artist?: string; title?: string }
  label?: string
  className?: string
}) {
  // Checked first: guests (and screens without a UI provider) render nothing
  if (!useMayWish()) return null
  return <WishButton prefill={prefill} label={label} className={className} />
}

function WishButton({ prefill, label, className }: { prefill?: { artist?: string; title?: string }; label?: string; className: string }) {
  const t = useMessages(wishText)
  const { showModal } = useUI()
  return (
    <button type="button" className={className} data-song-wish onClick={() => showModal(t.dialogTitle, <WishForm prefill={prefill} />, [], {})}>
      <Icon name="add" size={20} />
      {label ?? t.open}
    </button>
  )
}

export function WishForm({ prefill }: { prefill?: { artist?: string; title?: string } }) {
  const t = useMessages(wishText)
  const { closeModal, addToast } = useUI()
  const [artist, setArtist] = useState(prefill?.artist ?? '')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = artist.trim().length > 0 && title.trim().length > 0

  async function send() {
    if (!ready) return
    setBusy(true)
    try {
      await api('/api/songs/wishes', { method: 'POST', json: { artist, title, note } })
      noteSent()
      await closeModal()
      addToast(t.thanks, 'success')
    } catch (e) {
      addToast(apiErrorText(e), 'error')
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <p className="text-body-md">{t.intro}</p>
      <label className="block">
        <span className="text-label-lg">{t.artist}</span>
        <input className="field mt-1 w-full" value={artist} maxLength={100} autoComplete="off" required onChange={(e) => setArtist(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-label-lg">{t.title}</span>
        <input className="field mt-1 w-full" value={title} maxLength={120} autoComplete="off" required onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-label-lg">{t.note}</span>
        <input className="field mt-1 w-full" value={note} maxLength={200} placeholder={t.noteHint} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-text m3-state-layer" onClick={() => void closeModal()}>
          {t.cancel}
        </button>
        <button type="submit" className="btn btn-filled m3-state-layer" disabled={busy || !ready}>
          <Icon name="add" size={20} />
          {t.send}
        </button>
      </div>
    </form>
  )
}

/** „Fehlt dir ein Song?“ with the button and the player's own wishes. */
export function SongWishCorner() {
  const t = useMessages(wishText)
  const may = useMayWish()
  const [wishes, setWishes] = useState<MyWish[]>([])

  const load = useCallback(() => {
    api<{ wishes: MyWish[] }>('/api/songs/wishes/mine')
      .then((r) => setWishes(r.wishes))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!may) return
    load()
    listeners.add(load)
    return () => {
      listeners.delete(load)
    }
  }, [may, load])

  if (!may) return null
  return (
    <section className="surface p-5 space-y-4" aria-labelledby="wish-h" data-wish-corner>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[12rem]">
          <h2 id="wish-h" className="text-title-md">
            {t.missingQuestion}
          </h2>
          <p className="meta">{t.missingHint}</p>
        </div>
        <SongWishButton />
      </div>
      {wishes.length > 0 && (
        <div>
          <h3 className="text-label-lg text-md-on-surface-variant mb-2">{t.mineHeading}</h3>
          <ul className="space-y-1.5">
            {wishes.map((w) => (
              <li key={w.id} className="flex items-center gap-3 text-body-md" data-wish-status={w.status}>
                <span className="flex-1 min-w-0 truncate">
                  {w.title} <span className="text-md-on-surface-variant">· {w.artist}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-label-md ${
                    w.status === 'added'
                      ? 'bg-md-success-container text-md-on-success-container'
                      : w.status === 'declined'
                        ? 'bg-md-surface-container-highest text-md-on-surface-variant'
                        : 'bg-md-secondary-container text-md-on-secondary-container'
                  }`}
                >
                  {t[`status_${w.status}`]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
