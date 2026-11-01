import type { Song } from '@/types'

export const RANDOM_START_MAX_S = 150 // ~3.5 min average song, keep ≥ 60 s left

/**
 * Where a new song starts (s): where it becomes recognisable (`startMs`,
 * silence and quiet intros skipped) — or a random point after that.
 */
export function startPosition(song: Pick<Song, 'startMs'>, random: boolean, rand: () => number): number {
  const from = (song.startMs ?? 0) / 1000
  if (!random) return from
  return Math.floor(from + rand() * Math.max(0, RANDOM_START_MAX_S - from))
}
