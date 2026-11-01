/**
 * Year tolerance — a handicap for mixed groups (parents and children, music
 * fans and occasional listeners). Per player, set in the setup:
 *
 *  - timeline modes: a card counts as right when it is at most `tolerance`
 *    years outside its gap; it then goes where it really belongs
 *    (placement.ts evaluatePlacement), so the timeline stays in order;
 *  - hardcore: the year guess scores as if it were `tolerance` years closer.
 *
 * Bots never get one (their strength is the difficulty). The chosen steps
 * stay small: ±5 already turns most decades into one gap.
 */
import type { Player } from '@/types'

export const TOLERANCE_STEPS = [0, 1, 2, 3, 5] as const
export const MAX_TOLERANCE = 5

/** A player's tolerance in years (0 when none, never for bots). */
export function toleranceOf(player: Pick<Player, 'tolerance' | 'isBot'> | undefined | null): number {
  if (!player || player.isBot) return 0
  const t = Math.round(Number(player.tolerance ?? 0))
  return Number.isFinite(t) ? Math.max(0, Math.min(MAX_TOLERANCE, t)) : 0
}

/** The next step when the chip is tapped (wraps to 0). */
export function nextTolerance(current: number): number {
  const i = TOLERANCE_STEPS.findIndex((s) => s === current)
  return TOLERANCE_STEPS[(i + 1) % TOLERANCE_STEPS.length]
}

/** Hardcore: the year difference that is scored. */
export function scoredDifference(yearDifference: number, tolerance = 0): number {
  return Math.max(0, yearDifference - Math.max(0, tolerance))
}
