/**
 * End of a round: the winner on a poster, the ranking, and two ways on —
 * a rematch with the same people, or back home.
 */
import { useEffect } from 'react'
import { rematchStarter } from '@/game/rematch'
import { coverSrc } from '@/utils/cover'
import { m } from 'motion/react'
import { Vinyl } from '@/components/ui/Vinyl'
import { Icon } from '@/components/ui/Icon'
import { celebrate } from '@/motion/celebrate'
import { haptic } from '@/utils/haptics'
import { spring } from '@/motion/springs'
import type { GameMode, Player } from '@/types'
import { rankPlayers } from '@/game/tiebreak'
import { useMessages } from '@/i18n'
import { wishText } from '@/i18n/messages/wishes'
import { gameText } from '@/i18n/messages/game'
import { achievementText } from '@/i18n/messages/achievements'
import { SignUpOffer } from './SignUpOffer'
import { SongWishButton } from '@/components/library/SongWish'
import { COVER_MAX, shareResultCard } from '@/utils/resultImage'
import { formatDay } from '@/utils/format'
import { dailyText } from '@/i18n/messages/daily'
import { DailyNotifyButton } from './DailyNotify'

interface GameOverProps {
  winner: Player
  players: Player[]
  mode: GameMode
  /** Missing online on a player's device: only the host starts the next round. */
  onRematch?: () => void
  onHome: () => void
  /** Online, not the host: who starts the next round. */
  rematchBy?: string
  homeLabel?: string
  /** Online guest without an account: offer one (their seat's name pre-filled). */
  signUpName?: string
  /** Today's round: the streak instead of a winner, and telling friends about it. */
  daily?: { day: string; streak: number; max: number }
  /** Achievement points each seat earned this round (a team: its members together). */
  earned?: Record<string, number>
  /** Song ids of the round, for the blurred cover mosaic behind the result. */
  songIds?: string[]
}

/** Points per seat this round; a team adds up its members. Seats without any are left out. */
export function earnedThisRound(players: Player[], pointsOf: (name: string) => number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of players) {
    if (p.isBot) continue
    const n = (p.members?.length ? p.members : [p.name]).reduce((sum, name) => sum + pointsOf(name), 0)
    if (n > 0) out[p.name] = n
  }
  return out
}

/** When a ranking row arrives (s): last place first, the winner last after a short pause. */
export function rankDelay(index: number, count: number): number {
  const fromBottom = count - 1 - index
  return 0.4 + fromBottom * 0.08 + (index === 0 ? 0.18 : 0)
}

export function GameOver({ winner, players, mode, onRematch, onHome, rematchBy, homeLabel, signUpName, daily, earned, songIds = [] }: GameOverProps) {
  const t = useMessages(gameText)
  const wt = useMessages(wishText)
  const at = useMessages(achievementText)
  const dt = useMessages(dailyText)
  const hardcore = mode === 'hardcore'
  // Again with the same people: whoever came last starts (game/rematch.ts)
  const stay = players.filter((p) => !p.left)
  const starter = stay.length > 1 ? stay[rematchStarter(stay, mode, winner.name)]?.name : undefined
  // Who left the room is listed last, without a place
  const ranked: { player: Player; place: number | null }[] = [
    ...rankPlayers(players.filter((p) => !p.left), mode, winner.name),
    ...players.filter((p) => p.left).map((player) => ({ player, place: null }))
  ]

  useEffect(() => {
    haptic('win')
    return celebrate('big')
  }, [])

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-md-surface"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={spring.effectsSlow}
    >
      <CoverMosaic ids={songIds} />
      <div className="relative mx-auto max-w-md px-6 pt-12 pb-10 min-h-full flex flex-col">
        <m.div
          className="self-center"
          initial={{ scale: 0.3, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring.spatialSlow}
        >
          <Vinyl size={200} spinning label={<Icon name="trophy" size={26} />} />
        </m.div>

        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.spatialDefault, delay: 0.25 }}>
          <p className="mt-8 text-title-md text-md-on-surface-variant text-center">{daily ? dt.gameOverTitle : t.winnerIs}</p>
          <h1 id="game-over-title" className="text-poster text-center break-words" style={{ fontSize: 'clamp(2.8rem, 14vw, 4.5rem)' }}>
            {daily ? dt.streak(daily.streak) : winner.name}
          </h1>
          {daily && (
            <p className="mt-2 text-title-md text-md-on-surface-variant text-center" data-daily-end>
              {daily.streak >= daily.max ? dt.allRight(daily.max) : dt.missedAt(daily.streak + 1)}
            </p>
          )}
          {winner.members && <p className="mt-2 text-title-md text-md-on-surface-variant text-center">{winner.members.join(', ')}</p>}
        </m.div>

        {!daily && (
        <ol className="mt-8 space-y-2">
          {ranked.map(({ player: p, place }, i) => (
            <m.li
              key={p.name}
              // The ranking fills from the bottom up and the winner arrives last, a beat later
              initial={i === 0 ? { opacity: 0, scale: 0.9, y: 12 } : { opacity: 0, x: -16 }}
              animate={i === 0 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, x: 0 }}
              transition={{ ...(i === 0 ? spring.spatialFast : spring.spatialDefault), delay: rankDelay(i, ranked.length) }}
              className={`flex items-center gap-4 px-4 min-h-[56px] rounded-m3-lg ${
                i === 0 ? 'bg-md-primary-container text-md-on-primary-container' : 'bg-md-surface-container-low'
              }`}
            >
              <span className="w-6 text-title-md tabular">{place === null ? '–' : `${place}.`}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-body-lg">{p.name}</span>
                {p.members && <span className="block truncate text-body-sm opacity-80">{p.members.join(', ')}</span>}
                {p.left && <span className="block truncate text-body-sm text-md-on-surface-variant">{t.leftShort}</span>}
              </span>
              <span className="text-right">
                <span className="block text-title-md num-poster">{hardcore ? t.pointsValue(p.score) : t.songsValue(p.cards)}</span>
                {earned?.[p.name] ? (
                  <m.span
                    className="block text-label-md num-poster opacity-90"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...spring.spatialFast, delay: rankDelay(i, ranked.length) + 0.35 }}
                    title={at.pointsThisRound}
                  >
                    {at.plusPoints(earned[p.name])}
                  </m.span>
                ) : null}
              </span>
            </m.li>
          ))}
        </ol>
        )}

        {signUpName !== undefined && <SignUpOffer name={signUpName} />}

        <div className="mt-auto pt-10 space-y-3">
          {daily && <DailyNotifyButton day={daily.day} streak={daily.streak} />}
          <button
            type="button"
            className="btn btn-tonal m3-state-layer w-full"
            onClick={() =>
              void shareResultCard({
                kicker: daily ? dt.gameOverTitle : t.winnerIs,
                headline: daily ? dt.streak(daily.streak) : winner.name,
                rows: daily
                  ? []
                  : ranked.map(({ player: p, place }) => ({
                      place: place === null ? '–' : `${place}.`,
                      name: p.name,
                      value: hardcore ? t.pointsValue(p.score) : t.songsValue(p.cards)
                    })),
                footer: `${formatDay(new Date().toISOString())} · mxtape.celox.io`,
                covers: songIds.slice(0, COVER_MAX).map((id) => coverSrc({ id }))
              })
            }
          >
            <Icon name="share" />
            {t.shareResult}
          </button>
          {onRematch ? (
            <div>
              <button type="button" className="btn btn-lg btn-brand m3-state-layer w-full" onClick={onRematch}>
                <Icon name="replay" />
                {t.rematch}
              </button>
              {starter && <p className="mt-2 text-center text-body-sm text-md-on-surface-variant">{t.rematchStarter(starter)}</p>}
            </div>
          ) : rematchBy ? (
            <p className="text-center text-body-md text-md-on-surface-variant">{t.rematchBy(rematchBy)}</p>
          ) : null}
          <button type="button" className="btn btn-text m3-state-layer w-full" onClick={onHome}>
            {homeLabel ?? t.toHome}
          </button>
          {/* A song was missing in this round? Ask for it (approved accounts only) */}
          <div className="flex justify-center">
            <SongWishButton className="btn btn-text m3-state-layer text-md-on-surface-variant" label={wt.missingQuestion} />
          </div>
        </div>
      </div>
    </m.div>
  )
}

/** Covers shown in the mosaic (enough to fill a phone screen, no more requests). */
export const MOSAIC_MAX = 12

/**
 * The round's covers as a soft, heavily blurred mosaic behind the result. A
 * surface veil on top keeps text readable: the covers add at most
 * MOSAIC_OPACITY × (1 − MOSAIC_VEIL) ≈ a sixth of their colour (worst case,
 * computed: muted text ≈ 6:1 light, ≈ 6.9:1 dark). Nothing without covers.
 */
export const MOSAIC_OPACITY = 0.55
export const MOSAIC_VEIL = 0.7

function CoverMosaic({ ids }: { ids: string[] }) {
  const shown = ids.slice(0, MOSAIC_MAX)
  if (shown.length === 0) return null
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-cover-mosaic>
      <m.div
        className="absolute -inset-[8%] grid grid-cols-3 sm:grid-cols-4"
        style={{ filter: 'blur(32px) saturate(1.25)' }}
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: MOSAIC_OPACITY, scale: 1 }}
        transition={spring.effectsSlow}
      >
        {Array.from({ length: 12 }, (_, i) => shown[i % shown.length]).map((id, i) => (
          <img key={i} src={coverSrc({ id })} alt="" className="w-full h-full object-cover aspect-square" loading="eager" />
        ))}
      </m.div>
      <div className="absolute inset-0 bg-md-surface" style={{ opacity: MOSAIC_VEIL }} />
    </div>
  )
}
