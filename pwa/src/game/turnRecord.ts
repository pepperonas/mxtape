/**
 * Turn records for the statistics (pure). One record per booked turn, built
 * where the turn is booked: on the placement (timeline modes, incl. an
 * objection) and when a guess is credited (hardcore).
 */
import { scoredDifference } from './tolerance'
import type { Player, Song, TurnRecord } from '@/types'
import type { GuessCheck } from './guess'
import { activeMember } from './teams'

/** No year given: validateGuess reports 9999. */
const NO_YEAR = 9999

function who(player: Player): Pick<TurnRecord, 'p' | 'team' | 'bot'> {
  const member = activeMember(player)
  return {
    p: member ?? player.name,
    ...(member ? { team: player.name } : {}),
    ...(player.isBot ? { bot: true as const } : {})
  }
}

export function placementRecord(
  placer: Player,
  song: Song,
  ok: boolean,
  isFirstCard: boolean,
  challenge: { by: Player; ok: boolean } | null
): TurnRecord {
  return {
    ...who(placer),
    s: song.id,
    y: song.year,
    ok,
    ...(isFirstCard ? { first: true as const } : {}),
    ...(challenge
      ? {
          ch: {
            by: activeMember(challenge.by) ?? challenge.by.name,
            ok: challenge.ok
          }
        }
      : {})
  }
}

export function guessRecord(player: Player, song: Song, check: GuessCheck, points: number): TurnRecord {
  const d = check.yearDifference >= NO_YEAR ? undefined : Math.abs(check.yearDifference)
  return {
    ...who(player),
    s: song.id,
    y: song.year,
    // Right = the year scored (a year tolerance counts); d stays the real difference
    ok: d !== undefined && scoredDifference(d, check.tolerance) <= 2,
    ...(d !== undefined ? { d } : {}),
    ti: check.titleMatch,
    ar: check.artistMatch,
    pts: points
  }
}
