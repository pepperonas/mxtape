/**
 * The next song, chosen ahead — so it can be loaded while the table looks at
 * the reveal, and starts without a wait when it is drawn.
 *
 * Only the device that runs the game chooses it, and it never leaves that
 * device before it is drawn (the snapshot carries the song on the platter
 * only). The choice is thrown away when the round's song options changed or
 * the song was played in the meantime (a joker swap, a skip).
 */
import type { Draw } from './songPool'
import { songKey } from './songPool'

export interface Upcoming {
  /** The round's song options when it was chosen (poolKey). */
  key: string
  draw: Draw
}

/** One string for everything that decides which songs may come. */
export function poolKey(options: {
  daily?: string | null
  decades: readonly number[]
  exotics: boolean
  genres?: readonly string[] | null
  collection?: string | null
  songIds?: readonly string[] | null
}): string {
  return JSON.stringify([
    options.daily ?? null,
    [...options.decades].sort(),
    options.exotics,
    options.genres ? [...options.genres].sort() : null,
    options.collection ?? null,
    options.songIds ?? null
  ])
}

/** The song chosen ahead, when it may still be drawn now. */
export function usableUpcoming(ready: Upcoming | null, key: string, played: readonly string[]): Draw | null {
  if (!ready || !ready.draw.song) return null
  if (ready.key !== key) return null
  if (played.includes(songKey(ready.draw.song))) return null
  return ready.draw
}
