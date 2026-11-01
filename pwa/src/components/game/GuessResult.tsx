/**
 * GuessResult — the hardcore verdict, unfolding in place of the guess form.
 *
 * Title, artist and year resolve one after another (staggered springs), the
 * true year flips in, and the total counts up. "Weiter" then credits the card
 * and points (useTurnFlow.continueTurn).
 */
import { useEffect, useRef } from 'react'
import { m } from 'motion/react'
import type { Song } from '@/types'
import type { GuessBreakdown } from '@/game/guess'
import { guessTier } from '@/game/guess'
import { spring } from '@/motion/springs'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { SongInfo } from './SongInfo'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'

interface GuessResultProps {
  song: Song
  check: { titleMatch: boolean; artistMatch: boolean; yearDifference: number; tolerance?: number }
  breakdown: GuessBreakdown
  playerName: string
  onContinue: () => void
  /** Online: who continues, when it is not this device. */
  continueBy?: string
}

const STAGGER = 0.11

export function GuessResult({ song, check, breakdown, playerName, onContinue, continueBy }: GuessResultProps) {
  const t = useMessages(gameText)
  const tier = guessTier(breakdown.total)
  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    continueRef.current?.focus({ preventScroll: true })
  }, [])

  const yearState = check.yearDifference === 0 ? 'hit' : breakdown.year > 0 ? 'near' : 'miss'
  const rows = [
    { key: 'title', label: t.title, value: song.title, state: check.titleMatch ? 'hit' : 'miss', points: breakdown.title },
    { key: 'artist', label: t.artist, value: song.artist, state: check.artistMatch ? 'hit' : 'miss', points: breakdown.artist },
    {
      key: 'year',
      label: t.year,
      value: String(song.year),
      state: yearState,
      points: breakdown.year,
      note:
        yearState === 'near'
          ? check.tolerance
            ? `${t.yearsOff(check.yearDifference)} · ${t.yearByTolerance(check.tolerance)}`
            : t.yearsOff(check.yearDifference)
          : undefined
    }
  ] as const

  return (
    <m.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: spring.effectsDefault }}
      transition={spring.spatialDefault}
      className="surface p-5 sm:p-6"
      aria-labelledby="guess-result-title"
    >
      <p className="text-label-md text-md-on-surface-variant">{playerName}</p>
      <h3 id="guess-result-title" className="text-headline-sm text-md-on-surface mb-4">
        {t[tier]}
      </h3>

      <ul className="space-y-2 mb-5">
        {rows.map((row, i) => (
          <m.li
            key={row.key}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.spatialDefault, delay: 0.08 + i * STAGGER }}
            className="flex items-center gap-3 p-3 rounded-m3-lg bg-md-surface-container-high"
          >
            <Verdict state={row.state} delay={0.16 + i * STAGGER} />
            <div className="min-w-0 flex-1">
              <p className="text-label-md text-md-on-surface-variant">{row.label}</p>
              {row.key === 'year' ? (
                <p className="text-title-md tabular-nums" style={{ perspective: 400 }}>
                  <m.span
                    className="inline-block"
                    initial={{ rotateX: -90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    transition={{ ...spring.spatialFast, delay: 0.2 + i * STAGGER }}
                  >
                    {row.value}
                  </m.span>
                  {'note' in row && row.note && <span className="ml-2 text-body-sm text-md-on-surface-variant">{row.note}</span>}
                </p>
              ) : (
                <p className="text-title-sm truncate">{row.value}</p>
              )}
            </div>
            <span
              className={`flex-shrink-0 text-label-lg tabular-nums ${row.points > 0 ? 'text-md-primary' : 'text-md-on-surface-variant'}`}
            >
              +{row.points}
            </span>
          </m.li>
        ))}
      </ul>

      <div className="mb-5">
        <SongInfo song={song} head="album" delay={0.1 + rows.length * STAGGER} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <m.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring.spatialFast, delay: 0.1 + rows.length * STAGGER }}
          className="text-display-sm text-brand"
        >
          +<AnimatedNumber value={breakdown.total} from={0} />
          <span className="ml-2 text-title-md text-md-on-surface-variant">{t.pointWord(breakdown.total)}</span>
        </m.p>
        {continueBy ? (
          <p className="text-body-sm text-md-on-surface-variant">{t.continuesAt(continueBy)}</p>
        ) : (
          <button ref={continueRef} type="button" onClick={onContinue} className="btn btn-brand">
            {t.next}
          </button>
        )}
      </div>
    </m.section>
  )
}

function Verdict({ state, delay }: { state: 'hit' | 'near' | 'miss'; delay: number }) {
  const t = useMessages(gameText)
  const tone =
    state === 'hit'
      ? 'bg-md-success-container text-md-on-success-container'
      : state === 'near'
        ? 'bg-md-warning-container text-md-on-warning-container'
        : 'bg-md-error-container text-md-on-error-container'
  return (
    <m.span
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...spring.spatialFast, delay }}
      className={`flex-shrink-0 w-9 h-9 grid place-items-center rounded-m3-full ${tone}`}
      role="img"
      aria-label={state === 'hit' ? t.verdictHit : state === 'near' ? t.verdictNear : t.verdictMiss}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === 'hit' ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : state === 'near' ? <path d="M6 12h12" /> : <path d="M7 7l10 10M17 7L7 17" />}
      </svg>
    </m.span>
  )
}
