/**
 * Game — orchestration only. Rules and turn order live in useTurnFlow.
 *
 * Layout: a slim bar (leave, mode), the players, the turntable, then the
 * mode's own part — the guess (hardcore) or the timeline with its placement
 * dock. On wide screens turntable and board sit side by side.
 */
import { useGoBack } from '@/navigation/useGoBack'
import { useAchievements } from '@/contexts/AchievementContext'
import { pointsSince } from '@/game/achievementPoints'
import { earnedThisRound } from '@/components/game/GameOver'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { concealed, jokersOf } from '@/game/bonus'
import { DAILY_MAX, dailyStreak } from '@/game/daily'
import { dailyText } from '@/i18n/messages/daily'
import { seatsOf, turnSeat } from '@/online/seats'
import { apiErrorText } from '@/i18n/messages/errors'

/** Same as the server's HOST_TAKEOVER_S. */
const TAKEOVER_AFTER_MS = 30_000

/**
 * TV mode: everything a little bigger for the far side of the room, and the
 * screen stays on (Wake Lock, where the browser has it).
 */
function useScreenMode(on: boolean) {
  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    const before = root.style.fontSize
    root.style.fontSize = 'clamp(16px, 1.35vw, 26px)'
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const acquire = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    void acquire()
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      root.style.fontSize = before
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [on])
}
import { useGame, useUI } from '@/contexts'
import { GuessForm, GameBoards, GuessResult, PlacementDock, FeedbackLayer, ScoreOverview, type DockState } from '@/components/game'
import { Turntable } from '@/components/game/Turntable'
import { PlayerStrip } from '@/components/game/PlayerStrip'
import { GameOver } from '@/components/game/GameOver'
import { Icon } from '@/components/ui/Icon'
import { useTurnFlow, type SkipNotice } from '@/game/useTurnFlow'
import { MODE_COPY } from '@/game/modeCopy'
import { turnName } from '@/game/teams'
import { coverSrc, roundSongIds } from '@/utils/cover'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { prefersReducedMotion } from '@/motion/policy'
import { getPreviewPlayer } from '@/services/PreviewPlayerService'
import { spring } from '@/motion/springs'
import type { Player, Song } from '@/types'
import { correctGapIndices, gapLabel } from '@/game/placement'
import { RoomProvider, useRoom } from '@/online/RoomContext'
import { roomsText } from '@/i18n/messages/rooms'
import { TvPanel } from '@/components/game/TvPanel'
import { audioRoleFor, musicSeat } from '@/online/musicSeat'
import { useObjectionWindow } from '@/online/useObjectionWindow'
import { useTurnClock } from '@/online/useTurnClock'
import { stepKey, visibleSecondsLeft } from '@/game/turnClock'
import { secondsLeft } from '@/game/objectionWindow'
import { useAuth } from '@/auth/AuthContext'
import { useRemoteTurnFlow } from '@/online/useRemoteTurnFlow'
import { useHostBridge } from '@/online/useHostBridge'
import { useHostPresence, usePresenceNotices } from '@/online/usePresence'
import { mayAct } from '@/online/rules'
import { roomApi } from '@/online/roomApi'
import type { Intent } from '@/online/protocol'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'

/** Set while we leave on purpose, so the "nothing to play" guard stays quiet. */
let leaving = false

export function GameScreen() {
  const navigate = useAppNavigate()
  const { gameMode, players, isGameStarted, tvRoom } = useGame()
  const [round, setRound] = useState(0)

  // Nothing to play (reload, deep link): back to the setup.
  useEffect(() => {
    leaving = false
  }, [])
  useEffect(() => {
    if (leaving) return
    if (!gameMode || players.length === 0 || !isGameStarted) navigate('/new', { replace: true })
  }, [gameMode, players.length, isGameStarted, navigate])

  // No reload warning any more: the round is saved on this device and
  // resumes where it stood (contexts/GameContext + game/savedGame).

  if (!gameMode || players.length === 0 || !isGameStarted) return null
  // Always inside a room provider (inert without a TV): connecting a TV later
  // must not remount the round, or the music would start over
  return (
    <RoomProvider code={tvRoom} mirror>
      <GameRound key={round} onRematch={() => setRound((r) => r + 1)} />
    </RoomProvider>
  )
}

const noop = () => {}

/**
 * One round on screen. Offline it drives the local flow; in an online room
 * the host's device does the same and shares it (useHostBridge), a player's
 * device mirrors the host and sends intents (useRemoteTurnFlow). Every control
 * asks `can()` whether this device may use it right now.
 */
export function GameRound({ onRematch }: { onRematch: () => void }) {
  const goBack = useGoBack()
  const t = useMessages(gameText)
  const rt = useMessages(roomsText)
  const { showModal, closeModal, addToast } = useUI()
  const {
    gameMode,
    players,
    currentPlayer,
    currentSong,
    resetGame,
    rematch,
    tiebreak,
    goal,
    absent,
    stepClock,
    turnLog,
    playedSongs,
    bonus,
    daily,
    startedAt,
    tvRoom,
    setTvRoom
  } = useGame()
  const { getPlayerAchievements } = useAchievements()
  const dt = useMessages(dailyText)
  const room = useRoom()
  // A round on one device mirrored to a TV is still a local round (its rules, its saved game)
  const mirror = Boolean(room?.mirror)
  const online = Boolean(room && room.seat !== null && !mirror)
  const onlineHost = online && room!.role === 'host'
  // A screen (TV mode) mirrors the round like a player but never acts
  const onlineScreen = online && room!.role === 'display'
  const onlinePlayer = online && room!.role !== 'host'
  // A guest without any account on this device: offered one when the round ends
  const { state: auth } = useAuth()
  useScreenMode(onlineScreen)
  const guestName = onlinePlayer && !onlineScreen && auth.kind === 'anonymous' ? (room!.members.find((m) => m.seat === room!.seat)?.name ?? '') : undefined

  // TV mode: the panel with the code; on one device, opening it creates the
  // room the round is mirrored to
  const [tvOpen, setTvOpen] = useState(false)
  const [tvBusy, setTvBusy] = useState(false)
  const [tvFailed, setTvFailed] = useState(false)
  const tvCode = online ? room!.code : tvRoom
  const openTv = async () => {
    setTvOpen(true)
    setTvFailed(false)
    if (online || tvRoom || tvBusy) return
    setTvBusy(true)
    try {
      const r = await roomApi.create('room', { tv: true })
      await roomApi.setStatus(r.code, 'running')
      setTvRoom(r.code)
    } catch {
      setTvFailed(true)
    } finally {
      setTvBusy(false)
    }
  }
  const disconnectTv = async () => {
    const code = tvRoom
    setTvOpen(false)
    setTvRoom(null)
    if (code) await roomApi.setStatus(code, 'closed').catch(() => {})
  }

  const [previewGap, setPreviewGap] = useState<number | null>(null)
  // Online player: the placement is on its way to the host — keep the card
  // where it is (no jump back to the dock) until the host's state arrives
  const [awaiting, setAwaiting] = useState(false)
  const [hoverGap, setHoverGap] = useState<number | null>(null)
  const [result, setResult] = useState<{ winner: Player; players: Player[] } | null>(null)
  const boardRef = useRef<HTMLOListElement>(null)

  const leaveGame = useCallback(async () => {
    leaving = true
    getPreviewPlayer().stop()
    await closeModal()
    // The host ends the room for everyone; a player leaves it (out of this round for good)
    if (onlineHost && room) await roomApi.setStatus(room.code, 'closed').catch(() => {})
    else if (onlinePlayer && room && !room.result) await roomApi.leave(room.code).catch(() => {})
    // The TV's room ends with the round
    if (tvRoom) await roomApi.setStatus(tvRoom, 'closed').catch(() => {})
    const wasDaily = daily
    resetGame()
    // Back to the page the round was started from, without a second copy of it
    goBack(wasDaily ? '/daily' : '/')
  }, [closeModal, resetGame, goBack, onlineHost, onlinePlayer, room, daily, tvRoom])

  const showSkipNotice = useCallback(
    (notice: SkipNotice, acknowledge: () => void) => {
      if (notice.kind === 'penalty') {
        showModal(
          t.skippedTooOften,
          <div className="space-y-4">
            <p className="text-body-lg">{t.skipPenaltyBody}</p>
            <div className="p-4 rounded-m3-lg bg-md-error-container text-md-on-error-container">
              <p className="text-label-md">{t.newScore}</p>
              <p className="text-display-sm tabular">{notice.newScore}</p>
            </div>
          </div>,
          [{ text: t.drawNewSong, variant: 'primary', onClick: acknowledge }],
          { required: true }
        )
      } else {
        showModal(
          t.skipCarefully,
          <p className="text-body-lg">
            {t.skipWarnBefore}
            <strong>{t.skipWarnPercent(Math.round((notice.nextPenaltyProbability ?? 0) * 100))}</strong>
            {t.skipWarnAfter}
          </p>,
          [{ text: t.understood, variant: 'primary', onClick: acknowledge }],
          { required: true }
        )
      }
    },
    [showModal, t]
  )

  /** This device has the music (set below, read by the flow after render). */
  const playsMusic = useRef(false)
  const localFlow = useTurnFlow({
    onGameOver: (winner, finalPlayers) => {
      getPreviewPlayer().stop()
      setResult({ winner, players: finalPlayers })
      // Today's round: the server has booked it song by song already (useTurnFlow)
    },
    // Online the skip is someone else's: no dialog on the host's device
    onSkipNotice: online
      ? (notice, acknowledge) => {
          if (notice.kind === 'penalty') addToast(t.skipPenaltyToast(notice.newScore), 'warning')
          acknowledge()
        }
      : showSkipNotice,
    // Online only the host's device plays the bots
    runBots: !onlinePlayer,
    // Load the next song ahead only where the music plays
    canPrefetch: () => playsMusic.current
  })
  const remoteFlow = useRemoteTurnFlow(room?.sendIntent ?? (noop as (i: Intent) => void))
  const flow = onlinePlayer ? remoteFlow : localFlow
  useHostBridge(localFlow, result ? { ...result, effects: [] } : null)
  useHostPresence(localFlow, onlineHost)
  usePresenceNotices(online)
  // Server time: the objection countdown reads the same on every device
  const clockOffset = room?.clockOffset
  const serverNow = useCallback(() => Date.now() + (clockOffset ? clockOffset() : 0), [clockOffset])
  useObjectionWindow(localFlow, onlineHost, serverNow)
  useTurnClock(localFlow, onlineHost, serverNow)
  // Players see the end of the round when the host's snapshot says so
  const shownResult = onlinePlayer ? (room?.result ?? null) : result
  useEffect(() => {
    if (onlinePlayer && room?.result) getPreviewPlayer().stop()
  }, [onlinePlayer, room?.result])

  const { phase, reveal, pending, activePlayer, activeTimeline, isBotThinking } = flow
  // Away: not connected right now, or skipped as absent (the host may act for them)
  const away = online
    ? players.flatMap((p, i) => {
        const m = room!.members.find((x) => x.seat === turnSeat(p))
        return (absent ?? []).includes(i) || !m || !m.online || m.left ? [i] : []
      })
    : []
  /** May this device do that now? Always yes on a single device. */
  const can = (action: Intent['action']) =>
    !online || mayAct({ phase, players, currentPlayer, pending, reveal, away }, room!.seat!, action, onlineHost)
  // The countdown of an open objection window ticks on every device
  const windowOpen = online && ((phase === 'challenge' && pending?.choosing === null && pending?.deadlineAt != null) || stepClock != null)
  // The step clock: everyone sees the last seconds before the game acts
  const clockSeconds = online
    ? visibleSecondsLeft(
        stepClock,
        stepKey(phase, currentPlayer, reveal?.song.id ?? currentSong?.id, turnLog?.length ?? 0, playedSongs?.length ?? 0),
        serverNow()
      )
    : null
  const [, setSecond] = useState(0)
  useEffect(() => {
    if (!windowOpen) return
    const id = window.setInterval(() => setSecond((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [windowOpen])
  // Players' devices: the host (who runs the round) lost the connection
  const hostMember = room?.members.find((m) => m.host)
  const hostAway = onlinePlayer && room?.connection === 'open' && Boolean(hostMember) && !hostMember!.online && !shownResult
  // After a while an account in the room may run the game instead (server checks the same)
  const [hostAwaySince, setHostAwaySince] = useState<number | null>(null)
  useEffect(() => {
    setHostAwaySince(hostAway ? Date.now() : null)
  }, [hostAway])
  const [, tick] = useState(0)
  useEffect(() => {
    if (!hostAwaySince) return
    const id = window.setTimeout(() => tick((n) => n + 1), TAKEOVER_AFTER_MS + 200)
    return () => window.clearTimeout(id)
  }, [hostAwaySince])
  const mayTakeOver =
    hostAway &&
    !onlineScreen &&
    auth.kind === 'signed-in' &&
    auth.me.status === 'approved' &&
    room?.status === 'running' &&
    hostAwaySince !== null &&
    Date.now() - hostAwaySince >= TAKEOVER_AFTER_MS
  const [takingOver, setTakingOver] = useState(false)
  const takeOver = async () => {
    setTakingOver(true)
    try {
      await room!.takeover()
      addToast(t.tookOver, 'success')
    } catch (e) {
      addToast(apiErrorText(e), 'error')
    } finally {
      setTakingOver(false)
    }
  }
  // A team counts as "mine" on every member's device (objections, own card)
  const isMine = (index: number) => !online || seatsOf(players[index]).includes(room!.seat!)
  // …but only the member on turn plays it
  const myTurn = (index: number) => !online || turnSeat(players[index]) === room!.seat
  // "Gemeinsam im Raum": the music plays on the device of whoever is on turn
  const hostSeat = room?.members.find((m) => m.host)?.seat ?? 0
  const musicAtSeat = online ? musicSeat(players, currentPlayer, absent ?? [], room!.members, hostSeat) : null
  // A connected screen (TV) has the music, in every mode: everyone else stays
  // silent and the play button steers the TV
  const screen = room?.members.find((m) => m.display && m.online && !m.left)
  const audioRole = audioRoleFor({
    mirror,
    online,
    screenOnline: Boolean(screen),
    music: room?.info?.music,
    seat: room?.seat ?? null,
    musicAtSeat,
    isHost: onlineHost
  })
  playsMusic.current = audioRole === 'local' || audioRole === 'host'
  const musicAt = screen ? screen.name : online && room!.info?.music !== 'everyone' ? room!.members.find((m) => m.seat === musicAtSeat)?.name : undefined
  const choosing = phase === 'challenge' && pending?.choosing != null ? pending.choosing : null

  // Phones: while a song is on the platter the player shrinks into a sticky
  // bar, so the board (where the action is) gets the screen.
  const narrow = useMediaQuery('(max-width: 1023px)')
  const compactPlayer = narrow && Boolean(currentSong)
  const playerBarRef = useRef<HTMLDivElement>(null)

  // When it is time to place (or to object), bring the board into view just
  // below the sticky bar — no hunting for the timeline under the record.
  const placingKey = (phase === 'placing' || choosing !== null) && narrow ? `${currentSong?.id}-${currentPlayer}-${choosing}` : null
  useEffect(() => {
    if (!placingKey) return
    const id = requestAnimationFrame(() => {
      const board = boardRef.current?.closest('section') ?? boardRef.current
      const bar = playerBarRef.current
      if (!board) return
      // Where the bar sits once it sticks: under the 64 px header
      const stickyBottom = 64 + (bar ? bar.getBoundingClientRect().height : 0)
      const top = board.getBoundingClientRect().top + window.scrollY - stickyBottom - 12
      if (Math.abs(top - window.scrollY) < 24) return
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [placingKey])

  useEffect(() => {
    setPreviewGap(null)
    setHoverGap(null)
    setAwaiting(false)
  }, [currentSong, currentPlayer, choosing, phase])
  // No answer (host gone): give the controls back so the tap can be repeated
  useEffect(() => {
    if (!awaiting) return
    const id = window.setTimeout(() => setAwaiting(false), 6000)
    return () => window.clearTimeout(id)
  }, [awaiting])

  if (!gameMode || !activePlayer) return null

  const isTimelineMode = gameMode !== 'hardcore'
  const humanTurn = !activePlayer.isBot
  const humanPlacing = isTimelineMode && phase === 'placing' && humanTurn && can('place')
  const challengeChoosing = choosing !== null && can('claim')
  const who = turnName(activePlayer)
  const nameAt = (index: number | null | undefined) => (index == null ? '' : (players[index]?.name ?? ''))

  // Bonus option: the card stays face down until the reveal
  const shownSong =
    currentSong && bonus && isTimelineMode && !reveal ? concealed(currentSong, t.hiddenTitle, t.hiddenArtist) : currentSong
  const placementReveal = reveal?.kind === 'placement' ? reveal : null
  const challenge = placementReveal?.challenge ?? null
  // A wrong card leaves the placer's timeline unchanged, so the gaps still match
  const rightPlaceFor = (correct: boolean, song: Song) => {
    if (correct) return undefined
    const gap = correctGapIndices(activeTimeline, song)[0]
    return gap === undefined ? undefined : gapLabel(activeTimeline, gap)
  }
  const dockState: DockState | null = awaiting
    ? { kind: 'waiting', text: t.sendingMove }
    : !isTimelineMode
    ? null
    : placementReveal
      ? {
          kind: 'revealed',
          song: placementReveal.song,
          isCorrect: placementReveal.isCorrect,
          isFirstCard: placementReveal.isFirstCard,
          cards: placementReveal.cardsAfter,
          playerName: players[placementReveal.playerIndex]?.name ?? '',
          challenge: challenge ? { name: players[challenge.playerIndex]?.name ?? '', won: challenge.won } : null,
          rightPlace: rightPlaceFor(placementReveal.isCorrect, placementReveal.song),
          byTolerance: placementReveal.byTolerance,
          continueBy: can('continue') ? undefined : nameAt(placementReveal.playerIndex),
          naming: placementReveal.naming ?? null
        }
      : phase === 'challenge' && pending
        ? choosing !== null
          ? challengeChoosing
            ? { kind: 'challenge-choose', challengerName: nameAt(choosing), previewGap, timeline: activeTimeline }
            : { kind: 'waiting', text: t.objectingWaiting(nameAt(choosing)) }
          : {
              kind: 'challenge-offer',
              placerName: turnName(players[pending.playerIndex] ?? activePlayer),
              // Online every device offers only its own objection
              challengers: pending.challengers
                .filter((seat) => isMine(seat) && !(pending.passed ?? []).includes(seat))
                .map((seat) => ({
                  seat,
                  name: players[seat]?.name ?? '',
                  left: players[seat]?.challenges ?? 0
                })),
              timeline: activeTimeline,
              gap: pending.gapIndex,
              revealBy: online || can('reveal') ? undefined : turnName(players[pending.playerIndex] ?? activePlayer),
              online,
              ownCard: online && isMine(pending.playerIndex),
              // Online: the window closes by itself — nobody reveals for the others
              passed: online && pending.challengers.some((i) => isMine(i) && (pending.passed ?? []).includes(i)),
              secondsLeft: online ? secondsLeft(pending.deadlineAt, serverNow()) : null
            }
        : phase === 'placing' && currentSong
          ? !humanTurn
            ? { kind: 'bot', playerName: activePlayer.name }
            : humanPlacing
              ? {
                  kind: 'placing',
                  song: shownSong!,
                  previewGap,
                  timeline: activeTimeline,
                  naming: bonus && !tiebreak,
                  jokers: jokersOf(activePlayer)
                }
              : { kind: 'waiting', text: t.placingOwnDevice(who) }
          : null

  // Shared timeline: a won objection puts the card on the board — show it there
  const boardReveal = placementReveal
    ? challenge?.won && gameMode === 'timeline_global'
      ? { song: placementReveal.song, gapIndex: challenge.gapIndex, isCorrect: true }
      : { song: placementReveal.song, gapIndex: placementReveal.gapIndex, isCorrect: placementReveal.isCorrect }
    : null

  const revealYear = reveal ? reveal.song.year : null
  const revealCorrect = !reveal
    ? null
    : reveal.kind === 'placement'
      ? reveal.isFirstCard
        ? null
        : reveal.isCorrect || Boolean(reveal.challenge?.won)
      : reveal.breakdown.total >= 10
        ? true
        : reveal.breakdown.total === 0
          ? false
          : null

  const confirmLeave = () =>
    onlinePlayer
      ? showModal(t.leaveRoom, <p className="text-body-lg">{t.leaveRoomBody}</p>, [
          { text: t.stay },
          { text: t.leave, variant: 'danger', closeOnClick: false, onClick: () => void leaveGame() }
        ])
      : daily
        ? // Today's round is paused, not thrown away: the server keeps it
          showModal(dt.pauseTitle, <p className="text-body-lg">{dt.pauseBody}</p>, [
            { text: t.keepPlaying },
            { text: dt.pause, variant: 'primary', closeOnClick: false, onClick: () => void leaveGame() }
          ])
        : showModal(
            onlineHost ? t.endForAll : t.endGame,
            <p className="text-body-lg">{onlineHost ? t.endForAllBody : t.endGameBody}</p>,
            [
              { text: t.keepPlaying },
              { text: t.end, variant: 'danger', closeOnClick: false, onClick: () => void leaveGame() }
            ]
          )

  const drawLabel = activePlayer.isBot
    ? t.drawFor(who)
    : activePlayer.members
      ? t.drawForMember(who, activePlayer.name)
      : t.songFor(who)

  return (
    <div className={`min-h-dvh ${dockState ? 'pb-56' : 'pb-12'} ${gameMode === 'hardcore' ? 'hardcore-theme' : ''}`}>
      <header className="sticky top-0 z-30 bg-md-surface/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl h-16 px-2 sm:px-4 flex items-center gap-1">
          <button type="button" className="icon-btn m3-state-layer" onClick={confirmLeave} aria-label={daily ? dt.pause : t.endGameLabel}>
            <Icon name={daily ? 'pause' : 'close'} />
          </button>
          <span className="flex items-center gap-2 text-title-md">
            <Icon name={MODE_COPY[gameMode].icon} size={20} className="text-md-primary" />
            {MODE_COPY[gameMode].name}
          </span>
          <span className="flex-1" />
          {tiebreak && (
            <span className="chip bg-md-tertiary-container text-md-on-tertiary-container" role="status">
              {tiebreak.round > 1 ? t.tiebreakRound(tiebreak.round) : t.tiebreak}
            </span>
          )}
          {!onlineScreen && (
            <button
              type="button"
              className={`icon-btn m3-state-layer ${screen ? 'bg-md-secondary-container text-md-on-secondary-container' : ''}`}
              onClick={() => (tvOpen ? setTvOpen(false) : void openTv())}
              aria-label={rt.tvConnect}
              aria-expanded={tvOpen}
              data-tv-button={screen ? 'connected' : 'idle'}
            >
              <Icon name="tv" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 space-y-6">
        <AnimatePresence initial={false}>
          {tvOpen && !onlineScreen && (
            <TvPanel
              key="tv"
              code={tvCode}
              screen={screen?.name}
              busy={tvBusy}
              failed={tvFailed}
              onDisconnect={mirror ? () => void disconnectTv() : undefined}
              onClose={() => setTvOpen(false)}
            />
          )}
        </AnimatePresence>
        <PlayerStrip thinking={isBotThinking} />
        {hostAway && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-m3-lg bg-md-error-container text-md-on-error-container px-4 py-3 text-body-md">
            <Icon name="hourglass" size={18} />
            <span className="flex-1 min-w-[12rem]">{mayTakeOver ? t.hostGoneTakeOver : t.hostAway}</span>
            {mayTakeOver && (
              <button type="button" className="btn btn-filled m3-state-layer" disabled={takingOver} onClick={() => void takeOver()}>
                {t.takeOver}
              </button>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          {/* On phones this column dissolves (contents), so the player bar can stick across the board */}
          <div className="min-w-0 max-lg:contents lg:space-y-6 lg:sticky lg:top-20">
            <div ref={playerBarRef} data-player-bar className={compactPlayer ? 'sticky top-16 z-20' : ''}>
            <Turntable
              compact={compactPlayer}
              caption={activePlayer.isBot || (online && !myTurn(currentPlayer)) ? t.theirTurn(who) : t.yourTurn(who)}
              song={currentSong}
              revealYear={revealYear}
              revealCorrect={revealCorrect}
              revealCover={reveal ? coverSrc(reveal.song) : null}
              onDraw={phase === 'idle' && can('draw') ? () => void flow.drawSong() : undefined}
              drawLabel={drawLabel}
              audioRole={audioRole}
              musicAt={musicAt}
              musicOnScreen={Boolean(screen)}
              cue={room?.cue ?? null}
              clockOffset={room?.clockOffset}
              onCue={audioRole === 'host' ? room!.sendAudio : undefined}
              onRemoteToggle={audioRole === 'silent' && screen && !onlineScreen ? room!.sendAudioCmd : undefined}
              // only a screen carries out play/pause from a phone
              remote={onlineScreen ? (room?.remote ?? null) : null}
            />
            {online && phase === 'idle' && !can('draw') && (
              <p className="text-center text-body-md text-md-on-surface-variant" role="status">
                {t.drawsNext(who)}
              </p>
            )}
            </div>

            {gameMode === 'hardcore' && (
              <AnimatePresence mode="wait" initial={false}>
                {reveal?.kind === 'guess' ? (
                  <GuessResult
                    key="result"
                    song={reveal.song}
                    check={reveal.check}
                    breakdown={reveal.breakdown}
                    playerName={players[reveal.playerIndex]?.name ?? ''}
                    onContinue={flow.continueTurn}
                    continueBy={can('continue') ? undefined : nameAt(reveal.playerIndex)}
                  />
                ) : phase === 'guessing' && online && !can('guess') ? (
                  <p key="waiting" className="surface p-5 text-center text-body-lg text-md-on-surface-variant" role="status">
                    {t.guessesOwnDevice(who)}
                  </p>
                ) : phase === 'guessing' && humanTurn ? (
                  <m.div
                    key={`form-${currentPlayer}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12, transition: spring.effectsDefault }}
                    transition={spring.spatialDefault}
                  >
                    <GuessForm onSubmit={flow.submitGuess} onSkip={flow.skip} />
                  </m.div>
                ) : null}
              </AnimatePresence>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            {gameMode === 'hardcore' && <ScoreOverview />}
            <GameBoards
              interactive={humanPlacing || challengeChoosing}
              previewGap={previewGap}
              hoverGap={hoverGap}
              reveal={boardReveal}
              revealPlayerIndex={placementReveal?.playerIndex ?? null}
              onGapSelect={(gap) => !awaiting && (humanPlacing || challengeChoosing) && setPreviewGap(gap)}
              onHoverGap={setHoverGap}
              boardRef={boardRef}
              placedGap={phase === 'challenge' ? (pending?.gapIndex ?? null) : null}
              placedBy={pending ? turnName(players[pending.playerIndex] ?? activePlayer) : undefined}
              previewIsChallenge={challengeChoosing}
              pendingSong={shownSong}
            />
          </div>
        </div>
      </main>

      {isTimelineMode && (
        <PlacementDock
          state={dockState}
          boardRef={boardRef}
          onHoverGap={setHoverGap}
          onPreview={setPreviewGap}
          onConfirm={(naming) => {
            if (previewGap === null) return
            if (challengeChoosing) flow.claimGap(previewGap)
            else flow.placeCard(previewGap, naming ?? null)
            if (onlinePlayer) setAwaiting(true)
            else setPreviewGap(null)
          }}
          onContinue={flow.continueTurn}
          onChallenge={flow.startChallenge}
          onPass={(seat) => flow.passChallenge(seat)}
          onCancelChallenge={flow.cancelChallenge}
          onReveal={flow.revealPlacement}
          onSwap={can('swap') && !tiebreak ? flow.swapSong : undefined}
          goal={goal}
        />
      )}

      <FeedbackLayer reveal={reveal} />

      {/* Online: the last seconds of a step, on every device */}
      <AnimatePresence>
        {clockSeconds !== null && !shownResult && (
          <m.p
            key="step-clock"
            role="timer"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.effectsDefault}
            aria-label={
              phase === 'idle' ? t.clockDraw(who, clockSeconds) : phase === 'revealed' ? t.clockContinue(clockSeconds) : t.clockLapse(who, clockSeconds)
            }
            className={`fixed right-4 z-40 whitespace-nowrap rounded-full px-3 py-1.5 text-label-lg tabular ${
              clockSeconds <= 10 ? 'bg-md-error-container text-md-on-error-container' : 'bg-md-surface-container-highest text-md-on-surface'
            }`}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
          >
            {phase === 'idle' ? t.clockDrawShort(clockSeconds) : phase === 'revealed' ? t.clockContinue(clockSeconds) : t.clockLapseShort(clockSeconds)}
          </m.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shownResult && (
          <GameOver
            winner={shownResult.winner}
            players={shownResult.players}
            mode={gameMode}
            daily={daily ? { day: daily, streak: dailyStreak(shownResult.winner.cards), max: DAILY_MAX } : undefined}
            earned={earnedThisRound(shownResult.players, (name) => pointsSince(getPlayerAchievements(name), startedAt))}
            songIds={roundSongIds({ turns: turnLog, players: shownResult.players })}
            onRematch={
              onlinePlayer || daily
                ? undefined
                : () => {
                    rematch(shownResult.winner.name)
                    onRematch()
                  }
            }
            rematchBy={onlinePlayer ? (room?.members.find((m) => m.host)?.name ?? t.theHost) : undefined}
            onHome={() => void leaveGame()}
            homeLabel={daily ? dt.toBoard : onlineHost ? t.closeRoom : onlinePlayer ? t.leaveRoomButton : undefined}
            signUpName={guestName}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
