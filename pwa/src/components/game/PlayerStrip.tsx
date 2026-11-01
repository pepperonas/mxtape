/**
 * Who is playing and who is on turn. The active player's chip widens to show
 * "ist dran"; the highlight travels between chips as one shared element.
 */
import { m } from 'motion/react'
import { useGame } from '@/contexts'
import { useRoom } from '@/online/RoomContext'
import { Icon } from '@/components/ui/Icon'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { spring } from '@/motion/springs'
import { activeMember, initialOf } from '@/game/teams'
import { ChallengeDots } from './PlacementDock'
import { toleranceOf } from '@/game/tolerance'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'

export function PlayerStrip({ thinking = false }: { thinking?: boolean }) {
  const t = useMessages(gameText)
  const { players, currentPlayer, gameMode, tiebreak, challengesEnabled, absent } = useGame()
  const room = useRoom()
  /** Online: left, skipped, or only the connection is gone (still within the grace period). */
  const presence = (i: number): string | null => {
    const p = players[i]
    if (p.left) return t.leftShort
    if (!room || p.seat === undefined) return null
    if ((absent ?? []).includes(i)) return t.skippedShort
    const m = room.members.find((x) => x.seat === p.seat)
    return m && !m.online && room.connection === 'open' ? t.awayShort : null
  }
  const hardcore = gameMode === 'hardcore'
  const showChallenges = challengesEnabled && !hardcore

  return (
    <ul className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1" aria-label={t.players}>
      {players.map((p, i) => {
        const active = i === currentPlayer
        const status = presence(i)
        const out = (Boolean(tiebreak) && !tiebreak!.contenders.includes(i)) || Boolean(p.left)
        return (
          <m.li
            key={p.name}
            layout
            transition={spring.spatialDefault}
            className={`relative shrink-0 flex items-center gap-2 h-12 pl-1.5 pr-4 rounded-m3-full ${out ? 'opacity-60' : ''}`}
            aria-current={active ? 'true' : undefined}
            aria-label={out ? t.notInTiebreak(p.name) : undefined}
          >
            {active && (
              <m.span
                layoutId="turn-highlight"
                transition={spring.spatialDefault}
                className="absolute inset-0 rounded-m3-full bg-md-primary-container"
                aria-hidden="true"
              />
            )}
            {!active && <span className="absolute inset-0 rounded-m3-full bg-md-surface-container-high" aria-hidden="true" />}
            <span
              className={`relative grid place-items-center w-9 h-9 rounded-full text-label-lg ${
                active ? 'bg-md-primary text-md-on-primary' : 'bg-md-surface-container-highest text-md-on-surface-variant'
              }`}
              aria-hidden="true"
            >
              {p.isBot ? <Icon name="bot" size={18} /> : p.members ? <Icon name="groups" size={18} /> : initialOf(p.name)}
            </span>
            <span className={`relative flex flex-col leading-tight ${active ? 'text-md-on-primary-container' : 'text-md-on-surface'}`}>
              <span className="flex items-center gap-1.5 text-label-lg">
                <span className="max-w-[9rem] truncate">{p.name}</span>
                {showChallenges && !p.isBot && (
                  <span className="opacity-80" title={t.objectionsLeft(p.challenges ?? 0)}>
                    <ChallengeDots left={p.challenges ?? 0} />
                    <span className="sr-only">, {t.objectionsLeft(p.challenges ?? 0)}</span>
                  </span>
                )}
                {toleranceOf(p) > 0 && (
                  <span className="opacity-80 tabular" data-strip-tolerance title={t.toleranceLabel(toleranceOf(p))}>
                    ±{toleranceOf(p)}
                    <span className="sr-only">, {t.toleranceLabel(toleranceOf(p))}</span>
                  </span>
                )}
                {(p.jokers ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 opacity-80 tabular" title={t.jokersLeft(p.jokers ?? 0)}>
                    <Icon name="swap" size={14} />
                    {p.jokers}
                    <span className="sr-only">, {t.jokersLeft(p.jokers ?? 0)}</span>
                  </span>
                )}
              </span>
              <span className={`text-label-sm tabular ${active ? '' : 'text-md-on-surface-variant'}`}>
                {active ? (p.isBot && thinking ? t.thinkingShort : p.members ? t.memberTurn(activeMember(p) ?? '') : t.isOnTurn) : null}
                {!active && (
                  <>
                    <AnimatedNumber value={hardcore ? p.score : p.cards} /> {hardcore ? t.pointsShort : t.songWord(p.cards)}
                  </>
                )}
                {status && (
                  <span data-presence className={active ? "font-medium" : "text-md-error"}>
                    {' · '}
                    {status}
                  </span>
                )}
              </span>
            </span>
            {active && (
              <m.span
                // A new card or points: the count pops once
                key={hardcore ? p.score : p.cards}
                initial={{ scale: 1.35 }}
                animate={{ scale: 1 }}
                transition={spring.spatialFast}
                className="relative ml-1 text-title-sm tabular text-md-on-primary-container"
              >
                <AnimatedNumber value={hardcore ? p.score : p.cards} />
              </m.span>
            )}
          </m.li>
        )
      })}
    </ul>
  )
}
