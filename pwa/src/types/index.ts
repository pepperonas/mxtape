// ============================================================================
// Core Game Types
// ============================================================================

export interface Song {
  id: string
  title: string
  artist: string
  year: number
  album?: string
  /** Short German "Wusstest du?" fact, shown after the reveal. */
  fact?: string
  /** English version of `fact`, shown when the app runs in English. */
  factEn?: string
  /** Little-known track (deep cut, club track): only drawn when the round allows exotics. */
  exotic?: boolean
  /** Sung in German (round option "Deutschsprachig"). */
  german?: boolean
  /** A crowd pleaser (round option "Party-Klassiker"). */
  party?: boolean
  /** Where the song becomes recognisable (silence and quiet intros skipped), ms. */
  startMs?: number
  spotifyId?: string
  previewUrl?: string
  youtubeUrl?: string
  points?: number  // Points earned for this song (Guess Mode only)
  genre?: string   // Genre for GENRE_HOPPER achievement (added v0.0.24)
  guessDetails?: {  // Detailed guess results for achievements (added v0.0.25)
    titleCorrect: boolean
    artistCorrect: boolean
    yearPoints: 0 | 1 | 2 | 5  // 5=exact, 2=±1 year, 1=±2 years, 0=wrong
  }
}

export interface Player {
  name: string
  timeline: Song[]  // Songs with optional points property
  cards: number  // Count of correctly placed cards
  score: number  // Points (Guess Mode only)
  isBot?: boolean  // Bot player flag (v0.0.32)
  botDifficulty?: 'easy' | 'medium' | 'hard'  // Bot difficulty level (v0.0.32)
  /** A bot's form this round (services/botForm.ts): rolled when the round starts. */
  botForm?: number
  /** Objections left (Einspruch, timeline modes). */
  challenges?: number
  /** Set for a team: the people in it, in turn order. */
  members?: string[]
  /** Team only: how many turns the team has had (picks the member at the controls). */
  memberTurn?: number
  /** Online rounds: the room seat (device) this player plays on. */
  seat?: number
  /** Online team: one seat per member, in the order of `members` (online/seats.ts). */
  seats?: number[]
  /** Online rounds: joined by link without an account. */
  guest?: boolean
  /** Online rounds: left on purpose — out for the rest of the round. */
  left?: boolean
  /** Bonus option: jokers earned by naming title and artist (game/bonus). */
  jokers?: number
  /** Year tolerance in years (game/tolerance): a handicap for mixed groups. */
  tolerance?: number
}

// ============================================================================
// Game Modes
// ============================================================================

export enum GameMode {
  HARDCORE = 'hardcore',
  TIMELINE_PERSONAL = 'timeline_personal',
  TIMELINE_GLOBAL = 'timeline_global'
}

export interface GameModeInfo {
  name: string
  description: string
  icon: string
  rules: string[]
  scoring: string
  features: string[]
}

// ============================================================================
// Game State
// ============================================================================

export interface GameState {
  players: Player[]
  currentPlayer: number
  currentSong: Song | null
  gameMode: GameMode | null
  globalTimeline: GlobalTimelineCard[]  // For TIMELINE_GLOBAL mode
  playedSongs: string[]   // Song IDs to prevent duplicates
  timestamp: number
  randomStartPosition: boolean
  isGameStarted: boolean
  waitingForGuess: boolean
}

export interface GlobalTimelineCard {
  song: Song
  playerId: number  // Index of player who placed this card
}

export interface SavedGameState extends GameState {
  version: string
  savedAt?: number
}

// ============================================================================
// Game History
// ============================================================================

export interface HistoryEntry {
  id: number  // Timestamp
  timestamp: number
  date: string  // ISO string
  winner: {
    name: string
    cards: number
    score: number
  }
  players: Array<{
    name: string
    cards: number
    score: number
    /** Team rounds: the people in the team. */
    members?: string[]
    /** A bot played this seat (since v0.6.0). */
    bot?: true
    /** The bot's strength (since v0.12.3). */
    level?: 'easy' | 'medium' | 'hard'
    timeline: Array<{
      id: string
      title: string
      artist: string
      year: number
      genre?: string  // Genre for statistics (added v0.0.31)
    }>
  }>
  gameMode: GameMode
  /** Legacy field from the physical-card era; ignored. */
  gameVariant?: string
  duration?: number
  totalRounds?: number
  /** Every booked turn in order (since v0.6.0; older rounds have none). */
  turns?: TurnRecord[]
  /** Wall-clock length of the round (since v0.6.0). */
  durationMs?: number
  /** The daily round's day, YYYY-MM-DD (since v0.12.6). */
  daily?: string
}

/**
 * One booked turn, kept compact (rounds are stored per account, 50 at most).
 * `p` is the person at the controls — for a team the member whose turn it was,
 * `team` then names the team. Hardcore fills the guess fields.
 */
export interface TurnRecord {
  p: string
  team?: string
  bot?: true
  /** Song id and its year. */
  s: string
  y: number
  /** Timeline: the card lay right. Hardcore: the year was within ±2. */
  ok: boolean
  /** Timeline: it was the player's first card (always right, says nothing). */
  first?: true
  /** Hardcore: |guessed year − year|, absent when no year was given. */
  d?: number
  /** Hardcore: title / artist right, points scored. */
  ti?: boolean
  ar?: boolean
  pts?: number
  /** An objection on this card: by whom (person/team name) and whether its gap was right. */
  ch?: { by: string; ok: boolean }
}

export interface GameHistoryData {
  version: string
  games: HistoryEntry[]
}

// ============================================================================
// UI State
// ============================================================================

export interface ModalOptions {
  required?: boolean  // Can't close by clicking outside
  wide?: boolean      // Wider modal
  noPadding?: boolean // No padding in modal body
  disableEscapeKey?: boolean // Disable ESC key to close
  disableBackdropClick?: boolean // Disable backdrop click to close
  hideCloseButton?: boolean // Hide the X close button
}

export interface ModalButton {
  text: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  closeOnClick?: boolean
  className?: string
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
  action?: { label: string; onClick: () => void }
}

export interface ToastOptions {
  duration?: number
  type?: 'success' | 'error' | 'warning' | 'info'
}

// ============================================================================
// Text Matching
// ============================================================================

export interface GuessResult {
  titleMatch: boolean
  artistMatch: boolean
  bothMatch: boolean
  yearCorrect?: boolean
  correctCount: number
}

// ============================================================================
// Achievements
// ============================================================================

export * from './achievements'

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
