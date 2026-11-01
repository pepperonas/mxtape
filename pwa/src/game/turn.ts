/**
 * Turn state shared by the game context (persisted) and the turn flow.
 * Kept in its own module so the context does not import the flow hook.
 */
import type { Song } from '@/types'
import type { validateGuess } from '@/services/gameLogic'
import type { GuessBreakdown } from './guess'
import type { ChallengeClaim } from './challenge'
import type { Naming, NamingResult } from './bonus'

export type TurnPhase = 'idle' | 'placing' | 'challenge' | 'guessing' | 'revealed' | 'over'

export interface ChallengeResult {
  playerIndex: number
  gapIndex: number
  isCorrect: boolean
  /** The challenger took the card. */
  won: boolean
}

export type Reveal =
  | {
      kind: 'placement'
      song: Song
      gapIndex: number
      isCorrect: boolean
      isFirstCard: boolean
      playerIndex: number
      /** Cards of the placing player after this placement. */
      cardsAfter: number
      challenge: ChallengeResult | null
      /** Bonus option: what the placer named, judged. */
      naming?: NamingResult | null
      /** Right only thanks to the placer's year tolerance (its size in years). */
      byTolerance?: number
    }
  | {
      kind: 'guess'
      song: Song
      check: ReturnType<typeof validateGuess> & { tolerance?: number }
      breakdown: GuessBreakdown
      playerIndex: number
    }

/** A placed card waiting to be revealed while others may object. */
export interface PendingPlacement {
  playerIndex: number
  gapIndex: number
  /** Seats allowed to object. */
  challengers: number[]
  /** Seat currently choosing a gap for an objection. */
  choosing: number | null
  claim: ChallengeClaim | null
  /** Online: who tapped "Kein Einspruch" (player indices). */
  passed?: number[]
  /** Online: when the objection window closes (server ms); see objectionWindow.ts. */
  deadlineAt?: number | null
  /** Bonus option: title and artist the placer named (judged at the reveal). */
  naming?: Naming | null
}
