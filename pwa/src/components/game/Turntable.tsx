/**
 * Turntable — the record player at the centre of the game.
 *
 * The record spins while the song plays, a ring around it shows the position,
 * and the label in the middle is the control: play/pause during the song, the
 * year once the card is revealed. With no song on the platter the big button
 * below draws the next one.
 *
 * compact: on phones, once a song is on the platter, the player shrinks into a
 * slim bar (small record, who is on turn, progress, play/pause) so the board
 * gets the screen. The record travels between both layouts as one shared
 * element; the audio is untouched (same component, same player).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Vinyl } from '@/components/ui/Vinyl'
import { Icon } from '@/components/ui/Icon'
import { useSettings, useUI } from '@/contexts'
import { getPreviewPlayer, type PlayerState } from '@/services/PreviewPlayerService'
import { spring } from '@/motion/springs'
import type { Song } from '@/types'
import type { AudioCue } from '@/online/protocol'
import { cuePosition } from '@/online/clock'
import { useBackdropPlaying } from '@/hooks/useBackdropPlaying'
import { preloadCover, useCoverColor } from '@/utils/coverColor'
import { coverSrc } from '@/utils/cover'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'
import { SpotifyHold } from './SpotifyHold'

interface TurntableProps {
  song: Song | null
  /** Year shown on the label after a reveal. */
  revealYear?: number | null
  revealCorrect?: boolean | null
  /** Album cover printed on the label after the reveal. */
  revealCover?: string | null
  /** Shown when no song is on the platter. */
  drawLabel?: string
  onDraw?: () => void
  drawDisabled?: boolean
  /** Slim bar layout (phones while a song is on the platter). */
  compact?: boolean
  /** Who is on turn, shown in the compact bar. */
  caption?: string
  /**
   * Online rounds:
   *  - 'host': plays like 'local' and reports every start, pause and jump (onCue);
   *  - 'follow': plays in sync with the host's cue ("Jeder bei sich");
   *  - 'silent': plays nothing, another device has the music ("Gemeinsam im Raum":
   *    the device of whoever is on turn, see musicSeat).
   * The role may change during a song (the music moves to another device):
   * the device that takes over continues from the last cue, the one that
   * hands over stops.
   */
  audioRole?: 'local' | 'host' | 'follow' | 'silent'
  /** 'silent': whose device has the music (default: the host). */
  musicAt?: string
  /** 'silent': the music is on a screen (TV mode) — said as „am Bildschirm“. */
  musicOnScreen?: boolean
  cue?: AudioCue | null
  clockOffset?: () => number
  onCue?: (cue: Omit<AudioCue, 'at'>) => void
  /**
   * 'silent' with a TV that has the music: the play button stays and asks the
   * TV to play or pause (TV mode — the phone is the remote control).
   */
  onRemoteToggle?: (playing: boolean) => void
  /** 'host': play/pause requests from a phone (n counts up per request). */
  remote?: { n: number; playing: boolean } | null
}

/** A follower jumps when it is further than this from the host (seconds). */
const SYNC_TOLERANCE_S = 0.25

const RANDOM_START_MAX_S = 150 // ~3.5 min average song, keep ≥ 60 s left

/**
 * Where a new song starts (s): where it becomes recognisable (`startMs`,
 * silence and quiet intros skipped) — or a random point after that.
 */
export function startPosition(song: Pick<Song, 'startMs'>, random: boolean, rand: () => number): number {
  const from = (song.startMs ?? 0) / 1000
  if (!random) return from
  return Math.floor(from + rand() * Math.max(0, RANDOM_START_MAX_S - from))
}

/** Reveal with a cover: the sleeve comes to the front, the record slides out to
 * the right behind it. Both shrink to SLEEVE_SCALE of the record's place; the
 * shifts are % of that place (88 % of the turntable). The cover is the picture,
 * the record only peeks out — kept inside the margin of a 320 px phone. */
export const SLEEVE_SCALE = 0.9
export const SLEEVE_SHIFT = 11
export const RECORD_SHIFT = 26

export function Turntable({
  song,
  revealYear,
  revealCorrect,
  revealCover,
  drawLabel,
  onDraw,
  drawDisabled,
  compact = false,
  caption,
  audioRole = 'local',
  cue = null,
  clockOffset = () => 0,
  onCue,
  onRemoteToggle,
  remote,
  musicAt,
  musicOnScreen = false
}: TurntableProps) {
  const t = useMessages(gameText)
  const { settings } = useSettings()
  const { addToast } = useUI()
  const player = useRef(getPreviewPlayer())
  // A stable report: the room context hands a new onCue after every cue, and
  // reporting again on that would loop (each report is a new cue)
  const onCueRef = useRef(onCue)
  onCueRef.current = onCue
  const [state, setState] = useState<PlayerState>('idle')
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  /** The browser blocked autoplay (after a reload): ask for a tap, no toast. */
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    if (state === 'playing') setBlocked(false)
  }, [state])

  useEffect(() => {
    const p = player.current
    p.setConfig({
      onStateChange: setState,
      onError: (msg) => addToast(msg, 'error'),
      onBlocked: () => setBlocked(true),
      onEnd: () => setPosition(0)
    })
    return () => {
      p.stop()
      p.setConfig({})
    }
  }, [addToast])

  // New song → play it (optionally from a random position). Followers wait
  // for the host's cue, silent devices never play.
  const songKey = song?.id ?? null
  useEffect(() => {
    setBlocked(false)
    if (!song) {
      player.current.stop()
      setPosition(0)
      setDuration(0)
      if (audioRole === 'host') onCueRef.current?.({ songId: null, playing: false, positionMs: 0 })
      return
    }
    if (audioRole === 'follow' || audioRole === 'silent') return
    // A device that joins in the middle of a song (a TV switched on during the
    // round) picks it up where the room's music stands; paused stays paused
    if (audioRole === 'host' && cue && cue.songId === song.id) {
      if (cue.playing) player.current.play(song, cuePosition(cue, Date.now(), clockOffset())).catch(() => {})
      return
    }
    const start = startPosition(song, settings.randomStartPosition, Math.random)
    player.current.play(song, start).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey])

  // The last cue seen: after a TV is disconnected the room (and its cue) is gone,
  // but this device should still pick the song up where the TV was
  const lastCue = useRef(cue)
  if (cue) lastCue.current = cue
  // The music moves to or away from this device in the middle of a song
  const lastRole = useRef(audioRole)
  useEffect(() => {
    const before = lastRole.current
    lastRole.current = audioRole
    if (before === audioRole) return
    const p = player.current
    if (audioRole === 'silent') {
      p.stop()
      return
    }
    if ((audioRole !== 'host' && audioRole !== 'local') || before !== 'silent' || !song) return
    // Take over where the previous device was (paused stays paused)
    const last = cue ?? lastCue.current
    if (last && last.songId === song.id) {
      if (last.playing) p.play(song, cuePosition(last, Date.now(), clockOffset())).catch(() => {})
    } else {
      p.play(song, startPosition(song, false, Math.random)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRole])

  // Host: tell the others where the music is — on every start/pause, and every
  // few seconds while playing (late joiners, slow devices)
  const report = useCallback(() => {
    if (audioRole !== 'host' || !song) return
    onCueRef.current?.({
      songId: song.id,
      playing: player.current.getState() === 'playing',
      positionMs: Math.round(player.current.getCurrentTime() * 1000)
    })
  }, [audioRole, song])
  const heard = useRef(false)
  useEffect(() => {
    // Also when a song ends (idle) or is stopped: the host's step clock gives
    // 30 s to place once the music has stopped
    if (state === 'playing' || state === 'paused') report()
    else if ((state === 'idle' || state === 'stopped') && heard.current) report()
    heard.current = state === 'playing' || state === 'paused'
  }, [state, report])
  useEffect(() => {
    if (audioRole !== 'host' || state !== 'playing') return
    const id = window.setInterval(report, 4000)
    return () => window.clearInterval(id)
  }, [audioRole, state, report])

  // Follower: start, jump or pause to match the host's cue; re-check every 2 s
  useEffect(() => {
    if (audioRole !== 'follow' || !song) return
    const sync = () => {
      if (!cue || cue.songId !== song.id) return
      const target = cuePosition(cue, Date.now(), clockOffset())
      const p = player.current
      if (p.getSongId() !== song.id) {
        if (cue.playing) p.play(song, target).catch(() => {})
        return
      }
      if (!cue.playing) {
        if (p.getState() === 'playing') p.pause()
        return
      }
      if (p.getState() === 'paused') p.resume()
      if (Math.abs(p.getCurrentTime() - target) > SYNC_TOLERANCE_S) p.seek(target)
    }
    sync()
    const id = window.setInterval(sync, 2000)
    return () => window.clearInterval(id)
  }, [audioRole, song, cue, clockOffset])

  // Position polling while playing (4 Hz is plenty for a ring)
  useEffect(() => {
    if (state !== 'playing') return
    const id = window.setInterval(() => {
      setPosition(player.current.getCurrentTime())
      setDuration(player.current.getDuration())
    }, 250)
    return () => window.clearInterval(id)
  }, [state])

  // Silent device: show the host's music, never play it
  const silentPlaying = audioRole === 'silent' && Boolean(song && cue?.songId === song.id && cue.playing)
  useEffect(() => {
    if (audioRole !== 'silent' || !song || !cue || cue.songId !== song.id) return
    const tick = () => setPosition(cuePosition(cue, Date.now(), clockOffset()))
    tick()
    if (!cue.playing) return
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [audioRole, song, cue, clockOffset])

  const playing = audioRole === 'silent' ? silentPlaying : state === 'playing'
  const loading = audioRole !== 'silent' && state === 'loading'
  useBackdropPlaying(playing)
  const toggle = useCallback(() => {
    if (audioRole === 'silent') {
      onRemoteToggle?.(!playing)
      return
    }
    if (playing) player.current.pause()
    else player.current.resume()
  }, [playing, audioRole, onRemoteToggle])
  // The device with the music carries out play/pause from the phone (TV mode)
  const remoteN = remote?.n ?? 0
  useEffect(() => {
    if (!remoteN || audioRole !== 'host' || !song || !remote) return
    const p = player.current
    if (!remote.playing) {
      if (p.getState() === 'playing') p.pause()
    } else if (p.getSongId() !== song.id) {
      p.play(song, startPosition(song, false, Math.random)).catch(() => {})
    } else if (p.getState() !== 'playing') {
      p.resume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteN])
  // Silent with a remote: the button stays and steers the TV
  const controllable = audioRole !== 'silent' || Boolean(onRemoteToggle)

  const progress = duration > 0 ? Math.min(1, position / duration) : 0
  const revealed = revealYear != null
  // The sleeve shows once revealed, when the cover exists (a failed image stays away)
  const [sleeveFailed, setSleeveFailed] = useState<string | null>(null)
  const showSleeve = revealed && Boolean(revealCover) && sleeveFailed !== revealCover
  const glow = useCoverColor(revealed ? revealCover : null)
  // Load the cover while the song plays, so the reveal shows it at once
  useEffect(() => {
    if (song) preloadCover(coverSrc(song))
  }, [song?.id])
  const record = (
    <Vinyl
      size="100%"
      spinning={playing && !revealed}
      labelColor={revealed ? labelColorFor(revealCorrect) : undefined}
      labelRing={revealed ? ringColorFor(revealCorrect) : undefined}
    />
  )

  if (compact && song) {
    return (
      <section
        aria-label={t.turntable}
        className="relative overflow-hidden flex items-center gap-3 pl-2 pr-2 py-2 rounded-m3-xl bg-md-surface-container-high/95 backdrop-blur-md shadow-m3-1"
      >
        {/* A breath of the cover's colour from the left once revealed */}
        <m.span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: glow ? `linear-gradient(90deg, rgb(${glow.join(' ')} / 0.32), rgb(${glow.join(' ')} / 0) 70%)` : undefined }}
          initial={false}
          animate={{ opacity: showSleeve && glow ? 1 : 0 }}
          transition={spring.effectsSlow}
        />
        {/* Revealed: the cover as a small sleeve in front, the record slides half out of it */}
        <m.div
          className="relative flex-shrink-0 h-14"
          initial={false}
          animate={{ width: showSleeve ? 84 : 56 }}
          transition={spring.spatialDefault}
        >
          <m.div
            layoutId="turntable-record"
            transition={spring.spatialDefault}
            className="absolute top-0 w-14 h-14"
            initial={false}
            animate={{ left: showSleeve ? 28 : 0 }}
          >
            {record}
            {revealed && !showSleeve && (
              <span
                className="absolute inset-0 grid place-items-center text-label-lg tabular font-bold"
                style={{ color: '#fff', textShadow: '0 1px 4px rgb(0 0 0 / 0.7)' }}
              >
                {revealYear}
              </span>
            )}
          </m.div>
          <AnimatePresence>
            {showSleeve && revealCover && (
              <m.span
                key={revealCover}
                className="absolute z-[1] left-0 top-0 w-14 h-14 rounded-m3-xs overflow-hidden shadow-m3-2 bg-md-surface-container-highest"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: spring.effectsFast }}
                transition={spring.spatialFast}
                data-sleeve
              >
                <SleeveHold song={song}>
                  <img src={revealCover} alt="" className="w-full h-full object-cover" onError={() => setSleeveFailed(revealCover)} />
                </SleeveHold>
              </m.span>
            )}
          </AnimatePresence>
        </m.div>
        <div className="relative min-w-0 flex-1">
          <p className="text-title-sm text-md-on-surface truncate" aria-live="polite">
            {blocked
              ? t.tapToPlay
              : revealed
                ? t.songIsFrom(revealYear ?? '')
                : audioRole === 'silent'
                  ? `${caption ?? t.playing} · ${musicOnScreen ? t.atScreen : musicAt ? t.atName(musicAt) : t.atHost}`
                  : (caption ?? t.playing)}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-m3-full bg-md-surface-container-highest overflow-hidden" role="presentation">
              <div
                className="h-full rounded-m3-full bg-md-primary origin-left"
                style={{ transform: `scaleX(${progress})`, transition: 'transform 250ms linear' }}
              />
            </div>
            <span className="text-label-sm text-md-on-surface-variant tabular">{loading ? '…' : formatTime(position)}</span>
          </div>
        </div>
        {controllable && (
          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            className={`flex-shrink-0 grid place-items-center w-12 h-12 rounded-m3-full m3-state-layer ${blocked ? 'mx-attention' : ''}`}
            style={{ background: 'rgb(var(--mx-brand))', color: 'rgb(var(--mx-on-brand))' }}
            aria-label={playing ? t.pause : t.play}
          >
            {loading ? (
              <span className="m3-loading-arc" style={{ borderTopColor: 'currentColor', borderRightColor: 'currentColor' }} />
            ) : (
              <Icon name={playing ? 'pause' : 'play'} />
            )}
          </button>
        )}
      </section>
    )
  }

  return (
    <section aria-label={t.turntable} className="flex flex-col items-center">
      <div className="relative" style={{ width: 'min(76vw, 320px)', aspectRatio: '1' }}>
        {/* The cover's colour glows behind the turntable once the song is revealed */}
        <m.div
          aria-hidden="true"
          className="absolute -inset-[10%] rounded-full pointer-events-none"
          style={{ background: glow ? `radial-gradient(closest-side, rgb(${glow.join(' ')} / 0.42), rgb(${glow.join(' ')} / 0) 100%)` : undefined }}
          initial={false}
          animate={{ opacity: showSleeve && glow ? 1 : 0, scale: showSleeve && glow ? 1 : 0.85 }}
          transition={spring.effectsSlow}
        />
        <m.div className="absolute inset-0" initial={false} animate={{ opacity: showSleeve ? 0 : 1 }} transition={spring.effectsDefault}>
          <ProgressHalo progress={song ? progress : 0} />
        </m.div>
        <m.div layoutId="turntable-record" transition={spring.spatialDefault} className="absolute inset-[6%]">
          <m.div
            className="w-full h-full"
            animate={{
              scale: showSleeve ? SLEEVE_SCALE : song ? 1 : 0.94,
              opacity: song ? 1 : 0.85,
              x: showSleeve ? `${RECORD_SHIFT}%` : '0%'
            }}
            transition={{ ...spring.spatialDefault, delay: showSleeve ? 0.15 : 0 }}
          >
            {record}
          </m.div>
        </m.div>
        {/* The sleeve in front, the record slides out of it to the right: the cover is the picture */}
        <AnimatePresence>
          {showSleeve && revealCover && (
            <m.div
              key={revealCover}
              className="absolute inset-[6%]"
              initial={{ x: '0%', scale: 0.7, rotate: 0, opacity: 0 }}
              animate={{ x: `-${SLEEVE_SHIFT}%`, scale: SLEEVE_SCALE, rotate: -2, opacity: 1 }}
              exit={{ x: '0%', scale: 0.7, rotate: 0, opacity: 0, transition: spring.effectsDefault }}
              transition={spring.spatialDefault}
              data-sleeve
            >
              <div className="w-full h-full rounded-m3-sm overflow-hidden shadow-m3-3 bg-md-surface-container-highest">
                <SleeveHold song={song}>
                  <img src={revealCover} alt="" className="w-full h-full object-cover" onError={() => setSleeveFailed(revealCover)} />
                </SleeveHold>
              </div>
              {/* Positioned by a plain wrapper: Motion owns the transform of the pill */}
              <span className="absolute inset-x-0 -bottom-5 flex justify-center">
                <m.span
                  className="block px-5 py-1 rounded-m3-full shadow-m3-2 text-poster tabular leading-tight"
                  style={{ fontSize: 'clamp(1.5rem, 7.5vw, 2.1rem)', background: yearFill(revealCorrect), color: '#fff' }}
                  initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 2 }}
                  transition={{ ...spring.spatialFast, delay: 0.3 }}
                  aria-live="polite"
                  data-sleeve-year
                >
                  {revealYear}
                </m.span>
              </span>
            </m.div>
          )}
        </AnimatePresence>

        {/* Centre control on the label (with a cover the year sits on the sleeve) */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none [&>*]:pointer-events-auto">
          <AnimatePresence mode="popLayout" initial={false}>
            {revealed && showSleeve ? null : revealed ? (
              <m.div
                key="year"
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, transition: spring.effectsFast }}
                transition={spring.spatialFast}
                className="text-poster tabular"
                style={{ fontSize: 'clamp(1.6rem, 8vw, 2.2rem)', color: '#fff', textShadow: '0 1px 6px rgb(0 0 0 / 0.55)' }}
                aria-live="polite"
              >
                {revealYear}
              </m.div>
            ) : song && controllable ? (
              <m.button
                key="control"
                type="button"
                onClick={toggle}
                disabled={loading}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0, transition: spring.effectsFast }}
                whileTap={{ scale: 0.88 }}
                transition={spring.spatialFast}
                className="grid place-items-center w-[26%] aspect-square rounded-full m3-state-layer"
                style={{ background: 'rgb(var(--mx-brand))', color: 'rgb(var(--mx-on-brand))' }}
                aria-label={playing ? t.pause : t.play}
              >
                {loading ? (
                  <span className="m3-loading-arc" style={{ borderTopColor: 'currentColor', borderRightColor: 'currentColor' }} />
                ) : (
                  <Icon name={playing ? 'pause' : 'play'} size={32} />
                )}
              </m.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 h-6 text-label-lg text-md-on-surface-variant tabular" aria-live="polite">
        {song
          ? revealed
            ? ''
            : audioRole === 'silent'
              ? musicOnScreen
                ? t.playingAtScreen(formatTime(position))
                : musicAt
                ? t.playingAt(musicAt, formatTime(position))
                : t.playingAtHost(formatTime(position))
              : blocked
                ? t.tapRecordToPlay
                : loading
                  ? t.loading
                  : `${formatTime(position)} / ${formatTime(duration)}`
          : ''}
      </div>

      <AnimatePresence initial={false}>
        {!song && onDraw && (
          <m.button
            key="draw"
            type="button"
            onClick={onDraw}
            disabled={drawDisabled}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: spring.effectsFast }}
            transition={spring.spatialDefault}
            className="btn btn-lg btn-brand m3-state-layer mt-2 w-full max-w-xs"
          >
            <Icon name="note" />
            {drawLabel ?? t.drawSong}
          </m.button>
        )}
      </AnimatePresence>
    </section>
  )
}

/** Thin ring around the record: the song's position. */
function ProgressHalo({ progress }: { progress: number }) {
  const r = 48.5
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--md-sys-color-surface-container-highest))" strokeWidth="1.4" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="rgb(var(--md-sys-color-primary))"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 250ms linear' }}
      />
    </svg>
  )
}

function labelColorFor(correct: boolean | null | undefined) {
  if (correct === true) return 'rgb(var(--md-ref-success-40))'
  if (correct === false) return 'rgb(var(--md-ref-error-40))'
  return undefined
}

/** The year on the sleeve: filled in the verdict's colour (white text). */
function yearFill(correct: boolean | null | undefined) {
  return labelColorFor(correct) ?? 'rgb(var(--mx-brand))'
}

function ringColorFor(correct: boolean | null | undefined) {
  if (correct === true) return 'rgb(var(--md-ref-success-60))'
  if (correct === false) return 'rgb(var(--md-ref-error-60))'
  return 'rgb(var(--mx-label))'
}

function formatTime(s: number) {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** The sleeve's cover opens the song in Spotify when held (only ever shown after the reveal). */
function SleeveHold({ song, children }: { song: Song | null; children: ReactNode }) {
  if (!song) return <>{children}</>
  return (
    <SpotifyHold song={song} className="block w-full h-full">
      {children}
    </SpotifyHold>
  )
}
