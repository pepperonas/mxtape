/**
 * Hardcore guess scoring breakdown (pure). Mirrors calculatePoints():
 * title 5 · artist 5 · year exact 5 / ±1 → 2 / ±2 → 1.
 */
import type { Song } from '@/types'
import { scoredDifference } from './tolerance'

export interface GuessCheck {
  titleMatch: boolean
  artistMatch: boolean
  yearDifference: number
  /** The guesser's year tolerance (game/tolerance); the year scores as if this much closer. */
  tolerance?: number
}

export interface GuessBreakdown {
  title: number
  artist: number
  year: 0 | 1 | 2 | 5
  total: number
}

export function yearPoints(yearDifference: number): 0 | 1 | 2 | 5 {
  if (yearDifference === 0) return 5
  if (yearDifference === 1) return 2
  if (yearDifference === 2) return 1
  return 0
}

export function guessBreakdown({ titleMatch, artistMatch, yearDifference, tolerance }: GuessCheck): GuessBreakdown {
  const title = titleMatch ? 5 : 0
  const artist = artistMatch ? 5 : 0
  const year = yearPoints(scoredDifference(yearDifference, tolerance))
  return { title, artist, year, total: title + artist + year }
}

export function guessDetailsFor(check: GuessCheck): NonNullable<Song['guessDetails']> {
  return {
    titleCorrect: check.titleMatch,
    artistCorrect: check.artistMatch,
    yearPoints: yearPoints(scoredDifference(check.yearDifference, check.tolerance))
  }
}

/** Headline tier for the result (drives copy and feedback intensity). */
export type GuessTier = 'perfect' | 'great' | 'good' | 'partial' | 'miss'

export function guessTier(total: number): GuessTier {
  if (total === 15) return 'perfect'
  if (total >= 10) return 'great'
  if (total >= 5) return 'good'
  if (total > 0) return 'partial'
  return 'miss'
}
