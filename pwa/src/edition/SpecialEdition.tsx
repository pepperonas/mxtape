/** A gift on this account's device only; nothing enters room snapshots or shares. */
import porscheSketch from './assets/porsche-911-sketch.png'
import { useEffect, useRef, useState, useId } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthMaybe } from '@/auth/AuthContext'
import { useGame } from '@/contexts/GameContext'
import { useReducedMotionPreference } from '@/motion/policy'

export const EDITION_WORDS = ['Annette', 'Porsche', '911', 'Stuttgart', 'Zuffenhausen'] as const

function quietSurface() {
  return !document.hidden && !document.querySelector('[role="dialog"], [role="alertdialog"]') &&
    !document.activeElement?.matches('input, textarea, [contenteditable="true"]')
}

export function useMartinEdition() {
  const auth = useAuthMaybe()
  return auth?.state.kind === 'signed-in' && auth.state.me.status === 'approved' && auth.state.me.edition === 'martin'
    ? auth.state.me : null
}

/** Keep the reference geometry and pen strokes; discard paper highlights when tinting. */
export function Sportwagen({ drawing = false }: { drawing?: boolean }) {
  const inkId = `edition-ink-${useId().replace(/:/g, '')}`
  return (
    <svg className={`edition-car${drawing ? ' edition-car-draw' : ''}`} viewBox="0 0 1619 972" fill="none" aria-hidden="true">
      <defs>
        <filter id={inkId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0" result="ink" />
          <feFlood floodColor="currentColor" result="tint" />
          <feComposite in="tint" in2="ink" operator="in" />
        </filter>
      </defs>
      <image className="edition-car-ink edition-car-guide" href={porscheSketch} width="1619" height="972" filter={`url(#${inkId})`} />
      <image className="edition-car-ink edition-car-finish" href={porscheSketch} width="1619" height="972" filter={`url(#${inkId})`} />
    </svg>
  )
}

/** Remounts with the settings route, so opening it presents the gift again. */
export function EditionDedication() {
  const me = useMartinEdition()
  const reduced = useReducedMotionPreference()
  if (!me) return null
  return (
    <section className="edition-dedication" aria-label="Von Martin für Martin">
      <div className="edition-dedication-glow" aria-hidden="true" />
      <div className="edition-dedication-grid" aria-hidden="true" />
      <div className="edition-dedication-copy">
        <span className="edition-kicker">Persönlich aufgelegt.</span>
        <h2><span>Von Martin</span> <strong>für Martin</strong></h2>
        <p>Für die nächste gemeinsame Runde.</p>
      </div>
      <div className="edition-dedication-art" aria-hidden="true">
        <span className="edition-dedication-911">911</span>
        <Sportwagen drawing={!reduced} />
      </div>
      <div className="edition-dedication-footer">
        <span>Eichbaum Edition</span><span>No. 911 <i aria-hidden="true" /></span>
      </div>
      <div className="edition-dedication-track" aria-hidden="true"><i /></div>
    </section>
  )
}

export function EditionBanner() {
  const me = useMartinEdition()
  const reduced = useReducedMotionPreference()
  if (!me) return null
  return (
    <section className="edition-banner" aria-label="Martins Special Edition">
      <div className="edition-banner-copy">
        <span className="edition-kicker">Eine Runde nur für dich</span>
        <h2>Martins <span>Special Edition</span></h2>
        <p><svg className="edition-oak" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22V7m0 11C3 20 1 13 5 12 0 8 6 5 8 7 6 0 16 0 15 6c6-4 10 3 5 6 5 4-1 9-8 6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg> Eichbaum Edition <span className="edition-number">No. 911</span></p>
      </div>
      <Sportwagen drawing={!reduced} />
      <div className="edition-banner-rule" aria-hidden="true" />
    </section>
  )
}

export function SpecialEdition() {
  const me = useMartinEdition()
  const game = useGame()
  const { pathname } = useLocation()
  const reduced = useReducedMotionPreference()
  const [word, setWord] = useState<string | null>(null)
  const pressed = useRef(false)
  const wordIndex = useRef(0)
  const turns = useRef(0)
  const seenReveal = useRef<string | null>(null)
  const accountId = me?.id ?? null
  const active = !!me && !/^\/(tv|imprint|privacy|terms|about|landing|help|reset-password)(\/|$)/.test(pathname)
  const inRound = active && (pathname === '/game' || pathname === '/daily' || pathname.startsWith('/room/'))
  const revealKey = game.reveal ? `${game.startedAt}:${game.turnLog.length}:${game.reveal.playerIndex}:${game.reveal.song.id}` : null
  const showWord = active && !reduced && (!inRound || !!game.reveal)

  useEffect(() => {
    if (!active) return
    document.documentElement.dataset.edition = 'martin'
    return () => { delete document.documentElement.dataset.edition }
  }, [active])

  useEffect(() => {
    wordIndex.current = 0
    turns.current = 0
    seenReveal.current = null
    setWord(null)
  }, [accountId])

  // Only the current turn, never a delayed surprise in a later guessing phase.
  useEffect(() => {
    if (!showWord || !inRound || !revealKey || !quietSurface() || pressed.current) return
    if (seenReveal.current === revealKey) return
    seenReveal.current = revealKey
    turns.current += 1
    if (turns.current % 3 === 0) setWord(EDITION_WORDS[wordIndex.current++ % EDITION_WORDS.length])
  }, [showWord, inRound, revealKey])

  useEffect(() => {
    if (!showWord || inRound) return
    const timer = window.setInterval(() => {
      if (quietSurface() && !pressed.current) setWord(EDITION_WORDS[wordIndex.current++ % EDITION_WORDS.length])
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [showWord, inRound])

  useEffect(() => {
    if (!showWord) setWord(null)
  }, [showWord])

  useEffect(() => {
    if (!word) return
    const timer = window.setTimeout(() => setWord(null), 4000)
    const hide = () => setWord(null)
    const observer = new MutationObserver(() => { if (!quietSurface()) hide() })
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('visibilitychange', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('focusin', hide)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('focusin', hide)
    }
  }, [word])

  useEffect(() => {
    if (!active) return
    const down = () => { pressed.current = true }
    const up = () => { pressed.current = false }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', up)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      window.removeEventListener('blur', up)
    }
  }, [active])

  if (!active) return null
  return (
    <>
      <div className="edition-backdrop" aria-hidden="true">
        <div className="edition-dial"><span>911</span><small>STUTTGART</small></div>
        <div className="edition-background-car"><Sportwagen /></div>
        <div className="edition-watermark">Eichbaum <span>Edition</span></div>
      </div>
      {showWord && word && <div key={word} className="edition-moment" aria-hidden="true"><span>EDITION 911</span><b>{word}</b><i /></div>}
    </>
  )
}
