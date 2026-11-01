/**
 * PlacementDock — the bottom sheet of the timeline modes.
 *
 * States (crossfaded with a layout spring):
 *  - placing: the song card lives here. Drag it onto the board, or tap a gap
 *    on the board. Dropping/tapping puts the card into the gap as a preview;
 *    one confirm places it (a wrong drop costs a card, so no fling-to-commit).
 *  - challenge-offer: the card lies face down; others may object (Einspruch)
 *    or it is turned over.
 *  - challenge-choose: the objecting player taps another gap and confirms.
 *  - revealed: the verdict with cover, year, progress and the song's fact;
 *    "Nächster Spieler".
 *  - bot: the bot is thinking.
 *
 * Drag physics live in game/useCardDrag (shared with the waiting card on the
 * board, which can be dragged to another gap): the card tilts with its
 * horizontal velocity, lifts on grab, snaps back to the dock if released away
 * from the board.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, m } from 'motion/react'
import type { Song } from '@/types'
import { useCardDrag } from '@/game/useCardDrag'
import { dragReturn, spring } from '@/motion/springs'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { pendingCardLayoutId } from './TimelineBoard'
import { PositionStrip } from './PositionStrip'
import { Icon } from '@/components/ui/Icon'
import { GripIcon } from '@/components/ui/GripIcon'
import { SongCover, SongInfo } from './SongInfo'
import { SpotifyHold } from './SpotifyHold'
import { MAX_JOKERS, type Naming, type NamingResult } from '@/game/bonus'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'

export interface DockChallenger {
  seat: number
  name: string
  left: number
}

export type DockState =
  | {
      kind: 'placing'
      song: Song
      previewGap: number | null
      timeline: Song[]
      /** Bonus option: the placer may name title and artist. */
      naming?: boolean
      /** Bonus option: jokers left; a swap is offered when > 0. */
      jokers?: number
    }
  | {
      kind: 'challenge-offer'
      placerName: string
      challengers: DockChallenger[]
      timeline: Song[]
      gap: number
      /** Online: this device may not reveal — who does. */
      revealBy?: string
      /** Online: each device speaks for one person, so no names on the buttons. */
      online?: boolean
      /** Online: this device placed the card (others may object). */
      ownCard?: boolean
      /** Online: this device said "Kein Einspruch" and waits for the others. */
      passed?: boolean
      /** Online: seconds until the card turns over by itself. */
      secondsLeft?: number | null
    }
  | { kind: 'challenge-choose'; challengerName: string; previewGap: number | null; timeline: Song[] }
  | {
      kind: 'revealed'
      song: Song
      isCorrect: boolean
      isFirstCard: boolean
      cards: number
      playerName: string
      challenge: { name: string; won: boolean } | null
      /** Wrong card: where it would have belonged ("Zwischen 1991 und 2003"). */
      rightPlace?: string
      /** Online: who continues, when it is not this device. */
      continueBy?: string
      /** Bonus option: what the placer named, judged. */
      naming?: NamingResult | null
    }
  | { kind: 'bot'; playerName: string }
  /** Online: someone else acts on their own device. */
  | { kind: 'waiting'; text: string }

interface PlacementDockProps {
  state: DockState | null
  boardRef: RefObject<HTMLOListElement | null>
  onHoverGap: (gap: number | null) => void
  onPreview: (gap: number | null) => void
  onConfirm: (naming?: Naming | null) => void
  onContinue: () => void
  /** Bonus option: spend a joker on another song. */
  onSwap?: () => void
  onChallenge?: (seat: number) => void
  onCancelChallenge?: () => void
  onReveal?: () => void
  /** Online: "Kein Einspruch" for this device's seat. */
  onPass?: (seat: number) => void
  /** Total cards needed to win (display only). */
  goal?: number
}

export function PlacementDock({
  state,
  boardRef,
  onHoverGap,
  onPreview,
  onConfirm,
  onContinue,
  onChallenge,
  onCancelChallenge,
  onReveal,
  onPass,
  onSwap,
  goal = 10
}: PlacementDockProps) {
  const t = useMessages(gameText)
  const stateKey = !state
    ? 'none'
    : state.kind === 'placing' || state.kind === 'challenge-choose'
      ? `${state.kind}-${state.previewGap === null ? 'pick' : 'confirm'}`
      : state.kind

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="popLayout" initial={false}>
          {state && (
            <m.section
              key={stateKey}
              layout
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24, transition: spring.effectsDefault }}
              transition={spring.spatialDefault}
              data-dock
              className="pointer-events-auto rounded-m3-xl bg-md-surface-container-high/95 backdrop-blur-md border border-md-outline-variant/60 shadow-m3-3 p-3 sm:p-4"
              aria-label={t.placeCard}
            >
              {state.kind === 'placing' && state.previewGap === null && (
                <DragStage
                  song={state.song}
                  boardRef={boardRef}
                  onHoverGap={onHoverGap}
                  onDrop={onPreview}
                  jokers={state.naming ? (state.jokers ?? 0) : undefined}
                  onSwap={onSwap}
                />
              )}
              {state.kind === 'placing' && state.previewGap !== null && (
                <ConfirmStage
                  timeline={state.timeline}
                  gap={state.previewGap}
                  onBack={() => onPreview(null)}
                  onConfirm={onConfirm}
                  naming={state.naming}
                />
              )}
              {state.kind === 'challenge-offer' && (
                <ChallengeOfferStage
                  state={state}
                  onChallenge={(seat) => onChallenge?.(seat)}
                  onReveal={() => onReveal?.()}
                  onPass={(seat) => onPass?.(seat)}
                />
              )}
              {state.kind === 'challenge-choose' && state.previewGap === null && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="flex-1 text-title-sm text-md-on-surface">
                    <span className="block text-label-md text-md-on-surface-variant">{t.objectionBy(state.challengerName)}</span>
                    {t.whereDoesItGo}
                  </p>
                  <button type="button" onClick={() => onCancelChallenge?.()} className="btn btn-text">
                    {t.noObjection}
                  </button>
                </div>
              )}
              {state.kind === 'challenge-choose' && state.previewGap !== null && (
                <ConfirmStage
                  title={t.objectionBy(state.challengerName)}
                  tone="tertiary"
                  timeline={state.timeline}
                  gap={state.previewGap}
                  confirmText={t.lodgeObjection}
                  onBack={() => onPreview(null)}
                  onConfirm={() => onConfirm()}
                />
              )}
              {state.kind === 'revealed' && <ResultStage state={state} goal={goal} onContinue={onContinue} />}
              {state.kind === 'bot' && <BotStage name={state.playerName} />}
              {state.kind === 'waiting' && <WaitingStage text={state.text} />}
            </m.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── drag ──────────────────────────────────────────────────────────────────

interface DragStageProps {
  song: Song
  boardRef: RefObject<HTMLOListElement | null>
  onHoverGap: (gap: number | null) => void
  onDrop: (gap: number) => void
  /** Bonus option: jokers left (undefined: no bonus round). */
  jokers?: number
  onSwap?: () => void
}

function DragStage({ song, boardRef, onHoverGap, onDrop, jokers, onSwap }: DragStageProps) {
  const t = useMessages(gameText)
  const { x, y, shift, tilt, onDragStart, onDrag, onDragEnd } = useCardDrag({ boardRef, onHoverGap, onDrop, fixed: true })

  return (
    <div className="flex flex-col gap-2">
      {/* the dock is fixed: counter the page scroll Motion adds while dragging */}
      <m.div style={{ y: shift }}>
        <m.div
          layoutId={pendingCardLayoutId(song.id)}
          drag
          dragSnapToOrigin
          dragElastic={0.18}
          dragTransition={dragReturn}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 1.05, boxShadow: 'var(--md-sys-elevation-4)', zIndex: 50 }}
          style={{ x, y, rotate: tilt }}
          transition={spring.spatialDefault}
          className="relative flex items-center gap-3 min-h-[56px] px-3 py-1.5 rounded-m3-lg border-2 border-md-primary bg-md-primary-container text-md-on-primary-container touch-none select-none cursor-grab active:cursor-grabbing"
          aria-label={t.dragCard(song.title, song.artist)}
          role="group"
        >
          <span className="flex-shrink-0 w-[4.25rem] h-10 grid place-items-center rounded-m3-md bg-md-surface-container-highest text-title-md text-md-on-surface-variant tabular-nums">
            ????
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-title-sm truncate">{song.title}</span>
            <span className="block text-body-sm opacity-80 truncate">{song.artist}</span>
          </span>
          <GripIcon />
        </m.div>
      </m.div>
      <div className="flex items-center justify-center gap-3">
        <p className="text-center text-body-sm text-md-on-surface-variant">{t.dragHint}</p>
        {jokers !== undefined && (
          <button
            type="button"
            className="btn btn-text m3-state-layer shrink-0"
            disabled={jokers < 1 || !onSwap}
            onClick={onSwap}
            aria-label={t.swapLabel(jokers)}
          >
            <Icon name="swap" size={18} />
            {t.swap}
            <ChallengeDots left={jokers} max={MAX_JOKERS} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── confirm ───────────────────────────────────────────────────────────────

function ConfirmStage({
  timeline,
  gap,
  onBack,
  onConfirm,
  title,
  confirmText,
  tone = 'primary',
  naming
}: {
  timeline: Song[]
  gap: number
  onBack: () => void
  onConfirm: (naming?: Naming | null) => void
  title?: string
  confirmText?: string
  tone?: 'primary' | 'tertiary'
  /** Bonus option: offer the title/artist fields. */
  naming?: boolean
}) {
  const t = useMessages(gameText)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [named, setNamed] = useState<Naming>({ title: '', artist: '' })
  const confirm = () => onConfirm(naming && (named.title.trim() || named.artist.trim()) ? named : null)
  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true })
  }, [gap])

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-label-md text-md-on-surface-variant">{title ?? t.confirmTitle}</p>
        <PositionStrip timeline={timeline} gap={gap} tone={tone} />
      </div>
      {naming && (
        <form
          className="grid grid-cols-2 gap-2 sm:w-64"
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
          aria-label={t.namingLabel}
        >
          <input
            className="field min-w-0"
            value={named.title}
            maxLength={120}
            placeholder={t.namingTitle}
            aria-label={t.namingTitle}
            autoComplete="off"
            onChange={(e) => setNamed((n) => ({ ...n, title: e.target.value }))}
          />
          <input
            className="field min-w-0"
            value={named.artist}
            maxLength={120}
            placeholder={t.namingArtist}
            aria-label={t.namingArtist}
            autoComplete="off"
            onChange={(e) => setNamed((n) => ({ ...n, artist: e.target.value }))}
          />
          <p className="col-span-2 text-label-md text-md-on-surface-variant">{t.namingHint}</p>
          <button type="submit" hidden />
        </form>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-text flex-1 sm:flex-none">
          {t.back}
        </button>
        <button ref={confirmRef} type="button" onClick={confirm} className="btn btn-brand flex-1 sm:flex-none">
          {confirmText ?? t.placeHere}
        </button>
      </div>
    </div>
  )
}

// ─── challenge ─────────────────────────────────────────────────────────────

function ChallengeOfferStage({
  state,
  onChallenge,
  onReveal,
  onPass
}: {
  state: Extract<DockState, { kind: 'challenge-offer' }>
  onChallenge: (seat: number) => void
  onReveal: () => void
  onPass: (seat: number) => void
}) {
  const t = useMessages(gameText)
  const revealRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    revealRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <p className="text-title-md text-md-on-surface">{t.hasPlaced(state.placerName)}</p>
        <PositionStrip timeline={state.timeline} gap={state.gap} />
        <p className="text-body-sm text-md-on-surface-variant">
          {!state.online
            ? t.objectionHint
            : state.ownCard
              ? t.othersMayObject
              : state.passed
                ? t.youPassed
                : state.challengers.length > 0
                  ? t.objectionHintOwn
                  : t.othersMayObject}
        </p>
        {state.online && state.secondsLeft != null && (
          <p className="text-label-lg text-md-on-surface-variant tabular" role="timer" aria-live="off">
            {t.revealsIn(state.secondsLeft)}
          </p>
        )}
      </div>
      {state.online ? (
        // One person per device: plain buttons, never one's own name
        state.challengers.slice(0, 1).map((c) => (
          <div key={c.seat} className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-tonal m3-state-layer"
              onClick={() => onChallenge(c.seat)}
              aria-label={`${t.lodgeObjection}, ${t.objectionsLeft(c.left)}`}
            >
              <Icon name="hand" size={18} />
              {t.objectionShort}
              <ChallengeDots left={c.left} />
            </button>
            <button ref={revealRef} type="button" className="btn btn-brand m3-state-layer" onClick={() => onPass(c.seat)}>
              {t.passObjection}
            </button>
          </div>
        ))
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.lodgeObjection}>
          {state.challengers.map((c) => (
            <button
              key={c.seat}
              type="button"
              className="chip m3-state-layer"
              onClick={() => onChallenge(c.seat)}
              aria-label={t.objectsLeft(c.name, c.left)}
            >
              <Icon name="hand" size={18} />
              {c.name}
              <ChallengeDots left={c.left} />
            </button>
          ))}
        </div>
      )}
      {state.online ? null : state.revealBy ? (
        <p className="text-body-sm text-md-on-surface-variant text-center py-2">{t.revealsWhenNoOne(state.revealBy)}</p>
      ) : (
        <button ref={revealRef} type="button" onClick={onReveal} className="btn btn-brand">
          {t.noObjectionReveal}
        </button>
      )}
    </div>
  )
}

/** Remaining objections as small filled dots (max three). */
export function ChallengeDots({ left, max = 3 }: { left: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < left ? 'bg-current' : 'bg-current opacity-25'}`} />
      ))}
    </span>
  )
}

// ─── result ────────────────────────────────────────────────────────────────

function verdictText(
  state: Extract<DockState, { kind: 'revealed' }>,
  t: (typeof gameText)['de']
): { title: string; detail?: string; good: boolean } {
  const { isFirstCard, isCorrect, challenge } = state
  if (isFirstCard) return { title: t.startCardPlaced, good: true }
  if (!challenge)
    return isCorrect
      ? { title: t.placedRight, good: true }
      : { title: t.wrong, detail: state.rightPlace ? t.rightWouldBe(state.rightPlace) : undefined, good: false }
  if (isCorrect) return { title: t.placedRight, detail: t.objectionMissed(challenge.name), good: true }
  if (challenge.won) return { title: t.objectionWon, detail: t.getsCard(challenge.name), good: true }
  return { title: t.bothWrong, detail: t.nobodyGetsCard, good: false }
}

function ResultStage({
  state,
  goal,
  onContinue
}: {
  state: Extract<DockState, { kind: 'revealed' }>
  goal: number
  onContinue: () => void
}) {
  const t = useMessages(gameText)
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [])
  const { isCorrect, song, cards, playerName } = state
  const verdict = verdictText(state, t)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="relative flex-shrink-0">
            <SpotifyHold song={song}>
              <SongCover song={song} size={52} />
            </SpotifyHold>
            <m.span
              initial={{ scale: 0.4, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={spring.spatialFast}
              className={`absolute -right-1.5 -bottom-1.5 w-6 h-6 grid place-items-center rounded-m3-full ring-2 ring-md-surface-container-high ${
                verdict.good ? 'bg-md-success-container text-md-on-success-container' : 'bg-md-error-container text-md-on-error-container'
              }`}
              aria-hidden="true"
            >
              {verdict.good ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              )}
            </m.span>
          </span>
          <div className="min-w-0">
            <p className="text-title-md text-md-on-surface">{verdict.title}</p>
            <p className="text-body-sm text-md-on-surface-variant truncate">
              {song.title} – {song.artist} · <span className="tabular-nums">{song.year}</span>
            </p>
            {verdict.detail && <p className="text-body-sm text-md-on-surface">{verdict.detail}</p>}
            {state.naming && <NamingLine result={state.naming} />}
            {!state.challenge?.won && (
              <p className="text-body-sm text-md-on-surface-variant tabular-nums">
                {playerName}: <span className="num-poster"><AnimatedNumber value={cards} from={isCorrect ? cards - 1 : cards} />/{goal}</span>
              </p>
            )}
          </div>
        </div>
        {state.continueBy ? (
          <p className="text-body-sm text-md-on-surface-variant max-w-[9rem] text-right">{t.continuesAt(state.continueBy)}</p>
        ) : (
          <button ref={nextRef} type="button" onClick={onContinue} className="btn btn-brand">
            {t.next}
          </button>
        )}
      </div>
      <SongInfo song={song} head="none" delay={0.2} />
    </div>
  )
}

function NamingLine({ result }: { result: NamingResult }) {
  const t = useMessages(gameText)
  const text = result.earned
    ? t.namingEarned
    : result.titleOk && result.artistOk
      ? t.namingFull
      : result.titleOk || result.artistOk
        ? t.namingHalf(result.titleOk ? t.namingTitle : t.namingArtist)
        : t.namingMissed
  return (
    <p className={`text-body-sm flex items-center gap-1.5 ${result.earned ? 'text-md-primary' : 'text-md-on-surface-variant'}`}>
      <Icon name="swap" size={16} />
      {text}
    </p>
  )
}

// ─── bot ───────────────────────────────────────────────────────────────────

function WaitingStage({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-2 text-title-sm text-md-on-surface" role="status">
      <Icon name="hourglass" size={20} />
      <span>{text}</span>
    </div>
  )
}

function BotStage({ name }: { name: string }) {
  const t = useMessages(gameText)
  return (
    <div className="flex items-center justify-center gap-3 py-2 text-title-sm text-md-on-surface">
      <Icon name="bot" size={20} />
      <span>{t.thinking(name)}</span>
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <m.span
            key={i}
            className="w-1.5 h-1.5 rounded-m3-full bg-current"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </div>
  )
}
