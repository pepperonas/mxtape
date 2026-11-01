/**
 * TimelineBoard — one chronological board for every mode (replaces the two
 * near-identical 10-slot grids).
 *
 * The board is a vertical list, oldest at the top. While the active (human)
 * player is placing, real insertion gaps appear between the cards; each gap is
 * a <button> with a spoken label ("Zwischen 1985 und 1992"), so placing works
 * by drag (PlacementDock), tap and keyboard alike.
 *
 * Motion:
 * - gaps spring in/out and the cards reflow with layout springs;
 * - the card being placed shares a layoutId with the dock card, so it travels
 *   from the dock into the gap, and from the gap to its final slot when
 *   revealed. The id is per song (`pendingCardLayoutId`): with one constant id
 *   the card revealed last turn kept it registered, and as soon as the next
 *   card was placed Motion treated the old one as the leaving copy and hid it
 *   (opacity 0, stacked behind the new card) — the timeline looked empty right
 *   when someone needed the years to object;
 * - the year flips in like a split-flap display on reveal; a wrong card
 *   shakes (damped) and stays as a ghost until the turn continues.
 * - the waiting card can be dragged to another gap (PreviewRow) and settles
 *   with a short squash wherever it lands; a right card lifts once.
 * Gap highlight during a drag uses transform/colour only — the layout must
 * not change while the drag measures it.
 */
import { useCallback, useEffect, useRef, useState, type Ref, type RefObject } from 'react'
import { SongCover } from './SongInfo'
import { SpotifyHold } from './SpotifyHold'
import { AnimatePresence, animate, m, useMotionValue } from 'motion/react'
import type { Song } from '@/types'
import { gapLabel } from '@/game/placement'
import { dragReturn, spring } from '@/motion/springs'
import { prefersReducedMotion } from '@/motion/policy'
import { useCardDrag } from '@/game/useCardDrag'
import { GripIcon } from '@/components/ui/GripIcon'
import { initialOf } from '@/game/teams'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'
import { useToastOptional } from '@/contexts/UIContext'
import { useDoubleTap } from '@/hooks/useDoubleTap'
import { copySong } from '@/utils/copySong'

/** Shared element id of a card on its way from the dock to its slot — one per song. */
export const pendingCardLayoutId = (songId: string) => `pending-card-${songId}`
/** The objector's preview of the same card. */
export const challengeCardLayoutId = (songId: string) => `challenge-card-${songId}`

export interface BoardCard {
  song: Song
  /** Global mode: who placed the card. */
  owner?: string
}

export interface BoardReveal {
  song: Song
  gapIndex: number
  isCorrect: boolean
}

interface TimelineBoardProps {
  cards: BoardCard[]
  /** Show insertion gaps (active human player is placing). */
  interactive?: boolean
  pendingSong?: Song | null
  /** Gap where the pending card waits for confirmation. */
  previewGap?: number | null
  /** Gap under the dragged card. */
  hoverGap?: number | null
  reveal?: BoardReveal | null
  onGapSelect?: (gap: number) => void
  hideYears?: boolean
  label: string
  boardRef?: Ref<HTMLOListElement>
  /** Einspruch: the placed card waits face down in this gap (not selectable). */
  placedGap?: number | null
  placedBy?: string
  /** The preview card is an objection (own look, own shared-element id). */
  previewIsChallenge?: boolean
  /** The waiting preview card was dragged to another gap. */
  onPreviewMove?: (gap: number) => void
  /** Gap under the dragged preview card (highlight). */
  onHoverGap?: (gap: number | null) => void
}

export function TimelineBoard({
  cards,
  interactive = false,
  pendingSong = null,
  previewGap = null,
  hoverGap = null,
  reveal = null,
  onGapSelect,
  hideYears = false,
  label,
  boardRef,
  placedGap = null,
  placedBy,
  previewIsChallenge = false,
  onPreviewMove,
  onHoverGap
}: TimelineBoardProps) {
  const t = useMessages(gameText)
  // Own handle on the list for the drag geometry, still handed to the parent
  const listRef = useRef<HTMLOListElement | null>(null)
  const setList = useCallback(
    (el: HTMLOListElement | null) => {
      listRef.current = el
      if (typeof boardRef === 'function') boardRef(el)
      else if (boardRef) (boardRef as { current: HTMLOListElement | null }).current = el
    },
    [boardRef]
  )
  const songs = cards.map((c) => c.song)
  const items: React.ReactNode[] = []

  // A card waiting in a gap (placed or previewed) colours its two neighbours'
  // year chips, so "between which years" is visible on the board. After the
  // reveal the card shows its own year, so nothing is marked any more.
  // During an objection both show: the placed card (primary) and the objector's
  // preview (tertiary, wins where the two share a neighbour).
  const marks = new Map<number, Mark>()
  const markAround = (gap: number, tone: Mark) => {
    marks.set(gap - 1, tone)
    marks.set(gap, tone)
  }
  if (pendingSong && placedGap !== null) markAround(placedGap, 'primary')
  if (interactive && pendingSong && previewGap !== null) markAround(previewGap, previewIsChallenge ? 'tertiary' : 'primary')
  const markFor = (index: number): Mark | undefined => marks.get(index)

  const renderGap = (gap: number) => {
    if (pendingSong && placedGap === gap) {
      items.push(
        <BoardRow key={`placed-${gap}`} layoutId={pendingCardLayoutId(pendingSong.id)} tone="placed">
          <CardContent song={pendingSong} yearHidden owner={placedBy} />
        </BoardRow>
      )
      return
    }
    if (interactive && pendingSong && previewGap === gap) {
      items.push(
        <PreviewRow
          // Per song, not per gap: moving the card keeps it one element that glides to the new gap
          key={`preview-${previewIsChallenge ? 'c' : 'p'}-${pendingSong.id}`}
          song={pendingSong}
          gap={gap}
          challenge={previewIsChallenge}
          boardRef={listRef}
          onMove={onPreviewMove}
          onHoverGap={onHoverGap}
        />
      )
      return
    }
    if (reveal && !reveal.isCorrect && reveal.gapIndex === gap) {
      items.push(
        <BoardRow key={`ghost-${reveal.song.id}`} layoutId={pendingCardLayoutId(reveal.song.id)} tone="wrong" shake copy={reveal.song}>
          <CardContent song={reveal.song} revealYear />
        </BoardRow>
      )
      return
    }
    if (interactive) {
      items.push(
        <GapButton
          key={`gap-${gap}`}
          gap={gap}
          label={gapLabel(songs, gap)}
          highlighted={hoverGap === gap}
          large={songs.length === 0}
          onSelect={onGapSelect}
        />
      )
    }
  }

  cards.forEach((card, i) => {
    renderGap(i)
    const isRevealed = Boolean(reveal?.isCorrect && reveal.song.id === card.song.id)
    items.push(
      <BoardRow
        key={card.song.id}
        layoutId={isRevealed ? pendingCardLayoutId(card.song.id) : undefined}
        tone={isRevealed ? 'correct' : 'default'}
        pop={isRevealed}
        copy={card.song}
      >
        <CardContent
          song={card.song}
          owner={card.owner}
          blurYear={hideYears && !isRevealed}
          revealYear={isRevealed}
          mark={isRevealed ? undefined : markFor(i)}
        />
      </BoardRow>
    )
  })
  renderGap(cards.length)

  return (
    <ol ref={setList} aria-label={label} className="flex flex-col gap-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {items}
      </AnimatePresence>
      {items.length === 0 && (
        <li className="py-8 text-center text-body-md text-md-on-surface-variant">{t.noCardsYet}</li>
      )}
    </ol>
  )
}

// ─── rows ──────────────────────────────────────────────────────────────────

type Tone = 'default' | 'preview' | 'placed' | 'challenge' | 'correct' | 'wrong'

const TONE_CLASS: Record<Tone, string> = {
  default: 'bg-md-surface-container-high border-transparent',
  preview: 'bg-md-primary-container text-md-on-primary-container border-md-primary shadow-m3-2',
  placed: 'bg-md-primary-container text-md-on-primary-container border-md-primary border-dashed',
  challenge: 'bg-md-tertiary-container text-md-on-tertiary-container border-md-tertiary shadow-m3-2',
  correct: 'bg-md-surface-container-high border-md-success',
  wrong: 'bg-md-error-container text-md-on-error-container border-md-error'
}

interface BoardRowProps {
  /** popLayout needs a ref on the presence child (React 19: ref is a prop). */
  ref?: Ref<HTMLLIElement>
  children: React.ReactNode
  layoutId?: string
  tone: Tone
  shake?: boolean
  /** Revealed right: lifts once (the counterpart of the wrong card's shake). */
  pop?: boolean
  /** A face-up card: a double tap copies "Artist – Title". Never set on a waiting card (its title may be hidden). */
  copy?: Song
}

function BoardRow({ ref, children, layoutId, tone, shake, pop, copy }: BoardRowProps) {
  const t = useMessages(gameText)
  const toast = useToastOptional()
  const [flash, setFlash] = useState(false)
  const tap = useDoubleTap(
    copy
      ? () => {
          void copySong(copy, toast ?? (() => {}), t).then((ok) => {
            if (!ok) return
            setFlash(true)
            setTimeout(() => setFlash(false), 450)
          })
        }
      : undefined
  )
  return (
    <m.li
      {...tap}
      data-copyable={copy ? '' : undefined}
      ref={ref}
      layout="position"
      layoutId={layoutId}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={
        shake
          ? { opacity: 1, scale: 1, x: [0, -14, 11, -7, 4, 0] }
          : pop
            ? { opacity: 1, scale: [1, 1.035, 1], x: 0 }
            : { opacity: 1, scale: 1, x: 0 }
      }
      exit={{ opacity: 0, scale: 0.92, transition: spring.effectsDefault }}
      transition={
        shake
          ? { default: spring.spatialDefault, x: { duration: 0.55, ease: [0.36, 0.07, 0.19, 0.97] } }
          : pop
            ? { default: spring.spatialDefault, scale: { duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1], times: [0, 0.35, 1] } }
            : spring.spatialDefault
      }
      data-pop={pop || undefined}
      className={`relative flex items-center gap-3 min-h-[52px] px-3 py-1.5 rounded-m3-lg border-2 transition-colors duration-m3-effects-slow ease-m3-effects-slow ${TONE_CLASS[tone]} ${pop ? 'mx-success-ring' : ''} ${copy ? 'select-none' : ''} ${flash ? '!border-md-primary' : ''}`}
    >
      {children}
    </m.li>
  )
}

/**
 * The card waiting in its gap for confirmation. It can be dragged to another
 * gap with the same physics as the dock card (useCardDrag); released on its
 * own gap or away from the board it springs back. It counts as a gap itself
 * (`data-gap-index`), so the geometry knows where "home" is. Each time it
 * lands it settles with a short squash — it has weight.
 */
function PreviewRow({
  ref,
  song,
  gap,
  challenge,
  boardRef,
  onMove,
  onHoverGap
}: {
  ref?: Ref<HTMLLIElement>
  song: Song
  gap: number
  challenge: boolean
  boardRef: RefObject<HTMLOListElement | null>
  onMove?: (gap: number) => void
  onHoverGap?: (gap: number | null) => void
}) {
  const t = useMessages(gameText)
  const movable = Boolean(onMove)
  const { x, tilt, onDragStart, onDrag, onDragEnd } = useCardDrag({
    boardRef,
    home: gap,
    onHoverGap: (g) => onHoverGap?.(g),
    onDrop: (g) => onMove?.(g)
  })
  const squash = useMotionValue(1)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const controls = animate(squash, [0.92, 1], { ...spring.spatialFast, delay: 0.12 })
    return () => controls.stop()
  }, [gap, squash])

  return (
    <m.li
      ref={ref}
      layout="position"
      layoutId={challenge ? challengeCardLayoutId(song.id) : pendingCardLayoutId(song.id)}
      data-gap-index={gap}
      data-preview-card=""
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: spring.effectsDefault }}
      transition={spring.spatialDefault}
      drag={movable}
      dragSnapToOrigin
      dragElastic={0.18}
      dragTransition={dragReturn}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.04, boxShadow: 'var(--md-sys-elevation-4)', zIndex: 50 }}
      style={{ x, rotate: tilt, scaleY: squash }}
      aria-label={movable ? t.moveCard(song.title) : undefined}
      className={`relative flex items-center gap-3 min-h-[52px] px-3 py-1.5 rounded-m3-lg border-2 transition-colors duration-m3-effects-slow ease-m3-effects-slow ${
        TONE_CLASS[challenge ? 'challenge' : 'preview']
      } ${movable ? 'touch-none select-none cursor-grab active:cursor-grabbing' : ''}`}
    >
      <CardContent song={song} yearHidden />
      {movable && <GripIcon />}
    </m.li>
  )
}

/** Colour of a neighbour's year chip next to a waiting card. */
type Mark = 'primary' | 'tertiary'

const MARK_CLASS: Record<Mark, string> = {
  primary: 'bg-md-primary text-md-on-primary',
  tertiary: 'bg-md-tertiary text-md-on-tertiary'
}

interface CardContentProps {
  song: Song
  owner?: string
  yearHidden?: boolean
  revealYear?: boolean
  blurYear?: boolean
  /** Neighbour of the waiting card: the year chip takes the slot's colour. */
  mark?: Mark
}

function CardContent({ song, owner, yearHidden, revealYear, blurYear, mark }: CardContentProps) {
  const t = useMessages(gameText)
  return (
    <>
      <span
        className={`flex-shrink-0 w-[4.25rem] h-10 grid place-items-center rounded-m3-md text-title-md tabular-nums transition-colors duration-m3-effects ${
          mark ? MARK_CLASS[mark] : 'bg-md-surface-container-highest'
        }`}
        style={{ perspective: 400 }}
      >
        {yearHidden ? (
          <span aria-label={t.yearHidden} className="text-poster" style={{ fontSize: '1.6rem' }}>
            ?
          </span>
        ) : revealYear ? (
          <m.span
            key={song.year}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ ...spring.spatialFast, delay: 0.18 }}
            className="block"
          >
            {song.year}
          </m.span>
        ) : (
          <span className={blurYear ? 'blur-[6px] select-none' : undefined} aria-hidden={blurYear || undefined}>
            {song.year}
          </span>
        )}
      </span>
      {/* The cover of every card that lies face up (never the waiting card: it could hint the era).
          Left out on the narrowest phones, where the title needs the room. */}
      {!yearHidden && (
        <span className="hidden min-[360px]:block" data-card-cover>
          <SpotifyHold song={song}>
            <SongCover song={song} size={40} />
          </SpotifyHold>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-title-sm truncate">{song.title}</span>
        <span className="block text-body-sm opacity-80 truncate">{song.artist}</span>
      </span>
      {owner && (
        <span
          className="flex-shrink-0 w-8 h-8 grid place-items-center rounded-m3-full bg-md-secondary-container text-md-on-secondary-container text-label-md"
          title={t.placedBy(owner)}
        >
          {initialOf(owner)}
        </span>
      )}
    </>
  )
}

interface GapButtonProps {
  ref?: Ref<HTMLLIElement>
  gap: number
  label: string
  highlighted: boolean
  large: boolean
  onSelect?: (gap: number) => void
}

function GapButton({ ref, gap, label, highlighted, large, onSelect }: GapButtonProps) {
  const t = useMessages(gameText)
  return (
    <m.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, scaleY: 0.4 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.4, transition: spring.effectsDefault }}
      transition={spring.spatialDefault}
      className="origin-center"
    >
      <m.button
        type="button"
        data-gap-index={gap}
        onClick={() => onSelect?.(gap)}
        animate={{ scale: highlighted ? 1.05 : 1 }}
        whileTap={{ scale: 0.97 }}
        transition={spring.spatialFast}
        aria-label={t.insertHere(label)}
        className={`m3-state-layer relative w-full flex items-center justify-center gap-2 rounded-m3-md border-2 border-dashed transition-colors duration-m3-effects ease-m3-effects ${
          large ? 'min-h-[88px] text-label-lg' : 'min-h-[36px] text-label-md'
        } before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
          highlighted
            ? 'border-md-primary bg-md-primary-container text-md-on-primary-container'
            : 'border-md-outline-variant text-md-on-surface-variant'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>{label}</span>
      </m.button>
    </m.li>
  )
}
