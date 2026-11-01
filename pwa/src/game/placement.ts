/**
 * Timeline placement rules (pure).
 *
 * Extracted verbatim from GameScreen so the rules can be tested and reused by
 * the board UI and the bots. Behaviour notes that are part of the rules:
 * - Equal years are allowed in any order (`>=`), so a 1985 card may go before
 *   or after another 1985 card.
 * - The very first card of a timeline is always "correct".
 */
import type { GameMode, GlobalTimelineCard, Player, Song } from '@/types'
import { msg } from '@/i18n'
import { modesText } from '@/i18n/messages/modes'

/** The songs a placement is judged against, in timeline order. */
export function timelineSongsFor(
  gameMode: GameMode | string | null,
  player: Player | undefined,
  globalTimeline: GlobalTimelineCard[]
): Song[] {
  if (gameMode === 'timeline_global') return globalTimeline.map((card) => card.song)
  return player?.timeline ?? []
}

export interface PlacementEvaluation {
  isCorrect: boolean
  /** Right only thanks to the player's year tolerance (game/tolerance): the card sits where it belongs. */
  byTolerance: boolean
  /** Timeline with the song inserted at the chosen gap (whether or not correct). */
  newTimeline: Song[]
  /** The timeline was empty — this is the starting card. */
  isFirstCard: boolean
}

export function evaluatePlacement(timeline: Song[], song: Song, gapIndex: number, tolerance = 0): PlacementEvaluation {
  const index = Math.max(0, Math.min(gapIndex, timeline.length))
  const newTimeline = [...timeline]
  newTimeline.splice(index, 0, song)
  const exact = newTimeline.every((s, i) => i === 0 || s.year >= newTimeline[i - 1].year)
  const isFirstCard = timeline.length === 0
  if (exact || tolerance <= 0) return { isCorrect: exact, byTolerance: false, newTimeline, isFirstCard }
  // Year tolerance: the neighbours may be off by up to `tolerance` years. The
  // card then goes where it really belongs, so the timeline stays in order.
  const before = timeline[index - 1]
  const after = timeline[index]
  const fits = (!before || song.year >= before.year - tolerance) && (!after || song.year <= after.year + tolerance)
  if (!fits) return { isCorrect: false, byTolerance: false, newTimeline, isFirstCard }
  const sorted = [...timeline]
  const at = sorted.findIndex((s) => s.year > song.year)
  sorted.splice(at === -1 ? sorted.length : at, 0, song)
  return { isCorrect: true, byTolerance: true, newTimeline: sorted, isFirstCard }
}

/** Human-readable gap description (app language), also used as the gap's accessible name. */
export function gapLabel(timeline: Song[], gapIndex: number): string {
  const t = msg(modesText)
  if (timeline.length === 0) return t.firstCard
  if (gapIndex <= 0) return t.before(timeline[0].year)
  if (gapIndex >= timeline.length) return t.after(timeline[timeline.length - 1].year)
  return t.between(timeline[gapIndex - 1].year, timeline[gapIndex].year)
}

/** All gap indices at which the song would be placed correctly. */
export function correctGapIndices(timeline: Song[], song: Song): number[] {
  const out: number[] = []
  for (let i = 0; i <= timeline.length; i++) {
    if (evaluatePlacement(timeline, song, i).isCorrect) out.push(i)
  }
  return out
}
