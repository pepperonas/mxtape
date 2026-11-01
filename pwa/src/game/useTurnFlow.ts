/**
 * Turn flow — the game loop as an explicit phase machine.
 *
 *   idle ──draw──────▶ placing (timeline modes) ──placeCard──▶ [challenge] ──▶ revealed ──continueTurn──▶ next player / over
 *                    └▶ guessing (hardcore)      ──submitGuess─────────────────▶ revealed ──continueTurn──▶ next player / over
 *
 * challenge: when someone still has objections left (game/challenge.ts), the
 * placed card waits face down; one player may object and pick another gap,
 * or the card is simply revealed. Reveal and pending placement live in the
 * game context, so a reload resumes mid-turn without crediting a card twice.
 *
 * The UI renders and animates each phase instead of chaining modals with
 * timeouts. Rules come from src/game/* and services/gameLogic and are applied
 * exactly as before:
 *  - timeline modes credit a correct card when it is placed; the win check
 *    runs when the turn is continued ("Nächster Spieler");
 *  - hardcore credits card + points when the result is continued ("Weiter").
 * Bots play through the same placeCard/submitGuess entry points.
 *
 * A round never ends in a draw: if the end condition is met while several
 * players share the lead, they play it out in a tiebreak (game/tiebreak.ts) —
 * one song each per round until exactly one leads. No skipping in a tiebreak.
 */
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useGame, useUI, useAchievements, useGameHistory, useSettings } from '@/contexts'
import { validateGuess, placeCardInTimeline } from '@/services'
import { BotPlayer } from '@/services/botPlayer'
import type { BotAction } from '@/services/botStrategies/types'
import { allSongs, songById } from '@/data/catalogue'
import type { HistoryEntry, Player, Song } from '@/types'
import { evaluatePlacement, timelineSongsFor } from './placement'
import { guessBreakdown, guessDetailsFor } from './guess'
import { endOfRoundAchievements, historyAchievements, peopleOf, realtimeScoreAchievements, roundCounters, type AchievementEffect } from './achievementRules'
import { evaluateSkip, SKIP_PENALTY_POINTS } from './skipRules'
import { afterTiebreakTurn, leadersAmong, startTiebreak } from './tiebreak'
import { stillIn } from './presence'
import { isRoundOver } from './roundEnd'
import { pickSong, songKey } from './songPool'
import { eligibleChallengers, resolveChallenge, type ChallengeClaim } from './challenge'
import { isTeam } from './teams'
import { deriveTurn } from './deriveTurn'
import { judgeNaming, jokersOf, type Naming } from './bonus'
import { guessRecord, placementRecord } from './turnRecord'
import { msg } from '@/i18n'
import { modesText } from '@/i18n/messages/modes'
import { dailyText } from '@/i18n/messages/daily'
import { dailyRunOver } from './daily'
import { reportDailyTurn } from './dailyReport'
import { toleranceOf } from './tolerance'
import { poolKey, usableUpcoming, type Upcoming } from './upcoming'
import { startPosition } from './startPosition'
import { getPreviewPlayer } from '@/services/PreviewPlayerService'
import { preloadCover } from '@/utils/coverColor'
import { coverSrc } from '@/utils/cover'

export type { Reveal, TurnPhase } from './turn'

export interface SkipNotice {
  kind: 'penalty' | 'danger'
  newScore?: number
  nextPenaltyProbability?: number
}

interface Options {
  /** Called once when the game ends, with the final player snapshot. */
  onGameOver: (winner: Player, players: Player[]) => void
  /** Called after a skip that needs to be explained (penalty / danger zone). */
  onSkipNotice: (notice: SkipNotice, acknowledge: () => void) => void
  /** Bots play on this device (false on players' devices online: the host plays them). */
  runBots?: boolean
  /**
   * This device plays the music: choose the next song ahead and load it while
   * the reveal is on screen (game/upcoming.ts). Asked when it is needed.
   */
  canPrefetch?: () => boolean
}

export function useTurnFlow({ onGameOver, onSkipNotice, runBots = true, canPrefetch }: Options) {
  const game = useGame()
  const {
    gameMode,
    players,
    currentPlayer,
    currentSong,
    playedSongs,
    globalTimeline,
    currentSongSkips,
    updatePlayer,
    setCurrentSong,
    addToGlobalTimeline,
    addToPlayedSongs,
    incrementSkipCount,
    resetSkipCounts,
    nextTurn,
    nextPlayerOnly,
    tiebreak,
    setTiebreak,
    goal,
    decades,
    exotics,
    genres,
    collection,
    songIds,
    challengesEnabled,
    bonus,
    daily,
    reveal,
    setReveal,
    pending,
    setPending,
    finished: gameOver,
    finish,
    startedAt,
    rankingsHistory,
    pushRanking,
    turnLog,
    logTurn,
    absent
  } = game
  const { addToast } = useUI()
  const { settings, rememberSong } = useSettings()
  const { applyEffects: applyAchievements } = useAchievements()
  const { saveGame, history } = useGameHistory()

  const [isBotThinking, setIsBotThinking] = useState(false)
  const botBusy = useRef(false)
  const widenedNoticeShown = useRef(false)
  const replayNoticeShown = useRef(false)
  // The log as of the latest booking — finishGame runs before the state has re-rendered
  const logRef = useRef(turnLog)
  logRef.current = turnLog
  const book = useCallback(
    (record: Parameters<typeof logTurn>[0]) => {
      logRef.current = [...logRef.current, record]
      logTurn(record)
      // Today's round: the server keeps the run, song by song (index = position after the start card)
      if (daily && songIds && !record.first) {
        const index = songIds.indexOf(record.s) - 1
        if (index >= 0) void reportDailyTurn(daily, index, record.ok, () => addToast(msg(dailyText).savedFailed, 'warning'))
      }
    },
    [logTurn, daily, songIds, addToast]
  )

  const { phase, activePlayer, activeTimeline } = deriveTurn({
    gameMode,
    players,
    currentPlayer,
    currentSong,
    globalTimeline,
    reveal,
    pending,
    finished: gameOver
  })

  // Achievements belong to people: teams and bots are never credited
  const teamNames = players.filter((p) => isTeam(p) || p.isBot).map((p) => p.name)
  const applyEffects = useCallback(
    (effects: AchievementEffect[]) => applyAchievements(effects.filter((fx) => !teamNames.includes(fx.player))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyAchievements, teamNames.join('|')]
  )

  // ── Song source ──────────────────────────────────────────────────────────
  const songOptions = poolKey({ daily, decades, exotics, genres, collection, songIds })
  /** Today's round: the next of its songs. */
  const nextDaily = useCallback(
    (): Song | null => (songIds ?? []).map(songById).find((s): s is Song => Boolean(s) && !playedSongs.includes(songKey(s!))) ?? null,
    [songIds, playedSongs]
  )
  const pickNow = useCallback(
    () =>
      pickSong(allSongs(), decades, playedSongs, settings.recentSongs, Math.random, exotics, {
        genres,
        collection,
        songIds
      }),
    [decades, playedSongs, settings.recentSongs, exotics, genres, collection, songIds]
  )
  /** The next song, chosen ahead and loaded while the reveal is on screen. */
  const upcoming = useRef<Upcoming | null>(null)

  const drawSong = useCallback((): Song | null => {
    // Today's round: its songs, one after the other
    if (daily && songIds) {
      const next = nextDaily()
      if (!next) return null
      addToPlayedSongs(songKey(next))
      setCurrentSong(next)
      return next
    }
    const ready = usableUpcoming(upcoming.current, songOptions, playedSongs)
    upcoming.current = null
    const { song, widened, replayed } = ready ?? pickNow()
    if (!song) {
      addToast(msg(modesText).allPlayed, 'warning')
      return null
    }
    if (replayed && !replayNoticeShown.current) {
      replayNoticeShown.current = true
      addToast(msg(modesText).replaying, 'info')
    } else if (widened && !replayed && !widenedNoticeShown.current) {
      widenedNoticeShown.current = true
      addToast(
        song.exotic && !exotics
          ? msg(modesText).widenedExotics
          : decades.length > 0
            ? msg(modesText).widenedDecades
            : msg(modesText).widenedTheme,
        'info'
      )
    }
    addToPlayedSongs(songKey(song))
    rememberSong(songKey(song))
    setCurrentSong(song)
    return song
  }, [daily, songIds, nextDaily, songOptions, playedSongs, pickNow, exotics, decades.length, addToPlayedSongs, rememberSong, setCurrentSong, addToast])

  // Choose and load the next song while the table looks at the reveal (or
  // waits to draw): it starts at once when drawn. Only where the music plays.
  const prefetchRef = useRef(canPrefetch)
  prefetchRef.current = canPrefetch
  useEffect(() => {
    if (gameOver || (phase !== 'revealed' && phase !== 'idle')) return
    if (!prefetchRef.current?.()) return
    let next: Song | null
    if (daily && songIds) {
      next = nextDaily()
    } else {
      if (!usableUpcoming(upcoming.current, songOptions, playedSongs)) {
        upcoming.current = { key: songOptions, draw: pickNow() }
      }
      next = upcoming.current?.draw.song ?? null
    }
    if (!next) return
    getPreviewPlayer().preload(next, startPosition(next, settings.randomStartPosition, Math.random))
    preloadCover(coverSrc(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameOver, songOptions, playedSongs.length])

  // ── Game end ─────────────────────────────────────────────────────────────
  const finishGame = useCallback(
    (winner: Player, finalPlayers: Player[]) => {
      if (gameOver) return
      finish()
      let entry: HistoryEntry | null = null
      try {
        entry = saveGame({
          winner: { name: winner.name, cards: winner.cards, score: winner.score },
          players: finalPlayers,
          gameMode: gameMode ?? '',
          turns: logRef.current,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          daily
        })
        addToast(msg(modesText).savedToHistory, 'success')
      } catch (error) {
        console.error('Failed to save game:', error)
      }
      // Achievements belong to people: players and team members, never bots or teams
      const people = peopleOf(finalPlayers)
      const games = entry ? [entry, ...(history ?? []).filter((g) => g.id !== entry!.id)] : (history ?? [])
      const pointsOf = (name: string) => finalPlayers.find((p) => p.name === name && !isTeam(p))?.score ?? 0
      applyEffects([
        ...endOfRoundAchievements({
          mode: gameMode ?? '',
          people,
          players: finalPlayers,
          winner,
          durationMinutes: startedAt ? (Date.now() - startedAt) / 60000 : Infinity,
          rankingsHistory,
          turns: logRef.current,
          genreOf: (id) => songById(id)?.genre,
          finishedAt: Date.now(),
          daily
        }),
        ...people.flatMap((name) => [...historyAchievements(name, games), ...roundCounters(name, games, entry, pointsOf(name))])
      ])
      onGameOver(winner, finalPlayers)
    },
    [gameOver, finish, saveGame, gameMode, addToast, applyEffects, startedAt, rankingsHistory, history, onGameOver, daily]
  )

  /**
   * After a turn has been booked: end the game, start or continue a tiebreak,
   * or hand over to the next player. `finalPlayers` already holds this turn.
   */
  const settleTurn = useCallback(
    (playerIndex: number, finalPlayers: Player[]): 'over' | 'next' => {
      if (tiebreak) {
        // An absent contender's song is skipped — it counts as played, or the
        // tiebreak round could never complete
        const away = (absent ?? []).filter((i) => tiebreak.contenders.includes(i) && !tiebreak.played.includes(i))
        const step = afterTiebreakTurn({ ...tiebreak, played: [...tiebreak.played, ...away] }, playerIndex, finalPlayers, gameMode)
        if (step.kind === 'winner') {
          setTiebreak(null)
          finishGame(finalPlayers[step.index], finalPlayers)
          return 'over'
        }
        if (step.tiebreak.round > tiebreak.round) {
          addToast(msg(modesText).stillTied(step.tiebreak.round), 'info')
        }
        setTiebreak(step.tiebreak)
        return 'next'
      }

      // Today's round ends at the first wrong card, or after its last song
      if (daily) {
        const last = logRef.current[logRef.current.length - 1]
        if (!dailyRunOver(last, songIds ?? [])) return 'next'
        finishGame(finalPlayers[playerIndex], finalPlayers)
        return 'over'
      }
      if (!isRoundOver(finalPlayers, gameMode, goal)) return 'next'
      // Who left cannot win
      const top = leadersAmong(finalPlayers, stillIn(finalPlayers), gameMode)
      if (top.length === 1) {
        finishGame(finalPlayers[top[0]], finalPlayers)
        return 'over'
      }
      setTiebreak(startTiebreak(top))
      addToast(msg(modesText).tie(top.map((i) => finalPlayers[i].name)), 'info')
      return 'next'
    },
    [tiebreak, gameMode, goal, setTiebreak, finishGame, addToast, absent, daily, songIds]
  )

  // ── Online: absent players ───────────────────────────────────────────────
  /** An absent player's turn moves on without booking anything. */
  const passTurn = useCallback(() => {
    if (gameOver) return
    const index = reveal?.playerIndex ?? pending?.playerIndex ?? currentPlayer
    setPending(null)
    setReveal(null)
    if (settleTurn(index, players) === 'over') return
    nextTurn()
  }, [gameOver, reveal, pending, currentPlayer, setPending, setReveal, settleTurn, players, nextTurn])

  /**
   * Someone left the room on purpose: out for the rest of the round. When
   * only one player is left, they win; a tiebreak goes on without the leaver.
   */
  const markLeft = useCallback(
    (index: number) => {
      if (gameOver || !players[index] || players[index].left) return
      const updated = players.map((p, i) => (i === index ? { ...p, left: true } : p))
      updatePlayer(index, { left: true })
      const remaining = stillIn(updated)
      if (remaining.length === 1) {
        if (tiebreak) setTiebreak(null)
        finishGame(updated[remaining[0]], updated)
        return
      }
      if (tiebreak?.contenders.includes(index)) {
        const contenders = tiebreak.contenders.filter((i) => i !== index)
        if (contenders.length === 1) {
          setTiebreak(null)
          finishGame(updated[contenders[0]], updated)
          return
        }
        setTiebreak({ ...tiebreak, contenders, played: tiebreak.played.filter((i) => i !== index) })
      }
    },
    [gameOver, players, updatePlayer, tiebreak, setTiebreak, finishGame]
  )

  // ── Timeline modes ───────────────────────────────────────────────────────
  /** Credit the card (placer or challenger) and show the result. */
  const resolvePlacement = useCallback(
    (playerIndex: number, gapIndex: number, claim: ChallengeClaim | null, naming: Naming | null = null) => {
      if (!currentSong) return
      const placer = players[playerIndex]
      if (!placer) return
      // Bonus: title and artist named right earns a joker, whatever the card did
      const named = bonus && naming && gameMode !== 'hardcore' ? judgeNaming(currentSong, naming, jokersOf(placer)) : null
      const jokers = named?.earned ? { jokers: jokersOf(placer) + 1 } : {}
      const timeline = timelineSongsFor(gameMode, placer, globalTimeline)
      const tolerance = { placer: toleranceOf(placer), challenger: claim ? toleranceOf(players[claim.playerIndex]) : 0 }
      const { isFirstCard, newTimeline } = evaluatePlacement(timeline, currentSong, gapIndex, tolerance.placer)
      const result = resolveChallenge(timeline, currentSong, gapIndex, claim, tolerance)

      if (result.outcome === 'placer') {
        if (gameMode === 'timeline_global') {
          addToGlobalTimeline(currentSong, playerIndex)
          updatePlayer(playerIndex, { cards: placer.cards + 1, ...jokers })
        } else {
          updatePlayer(playerIndex, { timeline: newTimeline, cards: placer.cards + 1, ...jokers })
        }
      } else if (named?.earned) {
        updatePlayer(playerIndex, jokers)
      }

      if (claim) {
        const challenger = players[claim.playerIndex]
        const spent = { challenges: Math.max(0, (challenger.challenges ?? 0) - 1) }
        if (result.outcome === 'challenger') {
          if (gameMode === 'timeline_global') {
            addToGlobalTimeline(currentSong, claim.playerIndex)
            updatePlayer(claim.playerIndex, { ...spent, cards: challenger.cards + 1 })
          } else {
            updatePlayer(claim.playerIndex, {
              ...spent,
              timeline: placeCardInTimeline(challenger.timeline, currentSong),
              cards: challenger.cards + 1
            })
          }
        } else {
          updatePlayer(claim.playerIndex, spent)
        }
      }

      book(
        placementRecord(
          placer,
          currentSong,
          result.placerCorrect,
          isFirstCard,
          claim ? { by: players[claim.playerIndex], ok: Boolean(result.challengerCorrect) } : null
        )
      )
      setPending(null)
      setReveal({
        kind: 'placement',
        song: currentSong,
        gapIndex,
        isCorrect: result.placerCorrect,
        ...(result.placerByTolerance ? { byTolerance: tolerance.placer } : {}),
        isFirstCard,
        playerIndex,
        cardsAfter: placer.cards + (result.outcome === 'placer' ? 1 : 0),
        challenge: claim
          ? {
              playerIndex: claim.playerIndex,
              gapIndex: claim.gapIndex,
              isCorrect: Boolean(result.challengerCorrect),
              won: result.outcome === 'challenger'
            }
          : null,
        naming: named
      })
    },
    [currentSong, players, gameMode, globalTimeline, addToGlobalTimeline, updatePlayer, setPending, setReveal, book, bonus]
  )

  const placeCard = useCallback(
    (gapIndex: number, naming: Naming | null = null) => {
      if (phase !== 'placing' || !currentSong || !activePlayer) return
      // Nobody away or gone can object
      const challengers = eligibleChallengers(players, currentPlayer, activeTimeline, {
        enabled: challengesEnabled && gameMode !== 'hardcore',
        tiebreak: Boolean(tiebreak)
      }).filter((i) => !(absent ?? []).includes(i) && !players[i]?.left)
      if (challengers.length > 0) {
        setPending({ playerIndex: currentPlayer, gapIndex, challengers, choosing: null, claim: null, naming })
        return
      }
      resolvePlacement(currentPlayer, gapIndex, null, naming)
    },
    [phase, currentSong, activePlayer, players, currentPlayer, activeTimeline, challengesEnabled, gameMode, tiebreak, setPending, resolvePlacement]
  )

  /** A player raises an objection and is now choosing a gap. */
  const startChallenge = useCallback(
    (seat: number) => {
      if (phase !== 'challenge' || !pending || !pending.challengers.includes(seat) || (pending.passed ?? []).includes(seat)) return
      // The deadline now times the choice of a gap (objectionWindow.ts)
      setPending({ ...pending, choosing: seat, deadlineAt: null })
    },
    [phase, pending, setPending]
  )

  const cancelChallenge = useCallback(() => {
    if (phase !== 'challenge' || !pending) return
    // Whoever drops an objection has had their chance on this card (counts as
    // "Kein Einspruch", or one person could hold the round forever); the
    // others get a fresh countdown
    const passed = pending.passed ?? []
    const by = pending.choosing
    setPending({
      ...pending,
      choosing: null,
      deadlineAt: null,
      passed: by !== null && !passed.includes(by) ? [...passed, by] : passed
    })
  }, [phase, pending, setPending])

  /** Online: someone allowed to object lets it go ("Kein Einspruch"). */
  const passChallenge = useCallback(
    (index: number) => {
      if (phase !== 'challenge' || !pending || pending.choosing !== null || !pending.challengers.includes(index)) return
      const passed = pending.passed ?? []
      if (passed.includes(index)) return
      setPending({ ...pending, passed: [...passed, index] })
    },
    [phase, pending, setPending]
  )

  /** Online: open the window (host's device), or move its deadline. */
  const setObjectionDeadline = useCallback(
    (deadlineAt: number) => {
      if (phase !== 'challenge' || !pending) return
      setPending({ ...pending, deadlineAt })
    },
    [phase, pending, setPending]
  )

  /** The objecting player puts the card into another gap — then it is revealed. */
  const claimGap = useCallback(
    (gapIndex: number) => {
      if (phase !== 'challenge' || !pending || pending.choosing === null || gapIndex === pending.gapIndex) return
      resolvePlacement(pending.playerIndex, pending.gapIndex, { playerIndex: pending.choosing, gapIndex }, pending.naming ?? null)
    },
    [phase, pending, resolvePlacement]
  )

  /** Nobody objects: turn the card over. */
  const revealPlacement = useCallback(() => {
    if (phase !== 'challenge' || !pending) return
    resolvePlacement(pending.playerIndex, pending.gapIndex, null, pending.naming ?? null)
  }, [phase, pending, resolvePlacement])

  /** Bonus: spend a joker on another song (the old one counts as played). */
  const swapSong = useCallback(() => {
    if (phase !== 'placing' || !bonus || tiebreak || !activePlayer || activePlayer.isBot || jokersOf(activePlayer) < 1) return
    updatePlayer(currentPlayer, { jokers: jokersOf(activePlayer) - 1 })
    drawSong()
  }, [phase, bonus, tiebreak, activePlayer, currentPlayer, updatePlayer, drawSong])

  // ── Hardcore ─────────────────────────────────────────────────────────────
  const submitGuess = useCallback(
    (title: string, artist: string, year: string) => {
      if (phase !== 'guessing' || !currentSong) return
      const tolerance = toleranceOf(activePlayer)
      const check = { ...validateGuess(title, artist, year, currentSong), ...(tolerance ? { tolerance } : {}) }
      setReveal({ kind: 'guess', song: currentSong, check, breakdown: guessBreakdown(check), playerIndex: currentPlayer })
    },
    [phase, currentSong, currentPlayer, activePlayer, setReveal]
  )

  const skip = useCallback(() => {
    if (phase !== 'guessing' || !currentSong || !activePlayer || tiebreak) return
    incrementSkipCount(currentPlayer)
    // Only players still in the round take turns (and can pass the song on)
    const result = evaluateSkip(currentSongSkips, currentPlayer, stillIn(players).length, gameMode === 'hardcore')

    if (result.penaltyApplied) {
      const newScore = activePlayer.score - SKIP_PENALTY_POINTS
      updatePlayer(currentPlayer, { score: newScore })
      onSkipNotice({ kind: 'penalty', newScore }, () => {
        resetSkipCounts()
        // Turn passes first (it clears the song), then the next player gets a
        // fresh song — the dialog promises one is drawn automatically.
        nextTurn()
        drawSong()
      })
    } else if (result.dangerZone) {
      onSkipNotice({ kind: 'danger', nextPenaltyProbability: result.nextPenaltyProbability }, () => nextPlayerOnly())
    } else {
      nextPlayerOnly()
    }
  }, [
    phase,
    currentSong,
    activePlayer,
    tiebreak,
    incrementSkipCount,
    currentPlayer,
    currentSongSkips,
    players.length,
    gameMode,
    updatePlayer,
    onSkipNotice,
    resetSkipCounts,
    nextTurn,
    drawSong,
    nextPlayerOnly
  ])

  // ── Continue after a reveal ──────────────────────────────────────────────
  const continueTurn = useCallback(() => {
    if (!reveal || gameOver) return

    if (reveal.kind === 'placement') {
      setReveal(null)
      // The placement already updated the player in state. A wrong card can
      // end the game too (it can complete a tiebreak round).
      if (settleTurn(reveal.playerIndex, players) === 'over') return
      nextTurn()
      return
    }

    // Hardcore: credit card + points now
    const player = players[reveal.playerIndex]
    const { breakdown, check, song } = reveal
    const newScore = player.score + breakdown.total
    const updated: Player = {
      ...player,
      timeline: placeCardInTimeline(player.timeline, song, breakdown.total, guessDetailsFor(check)),
      cards: player.cards + 1,
      score: newScore
    }
    updatePlayer(reveal.playerIndex, { timeline: updated.timeline, cards: updated.cards, score: updated.score })
    book(guessRecord(player, song, check, breakdown.total))
    applyEffects(realtimeScoreAchievements(player.name, player.score, newScore))

    const updatedPlayers = players.map((p, i) => (i === reveal.playerIndex ? updated : p))
    pushRanking({
      turn: updated.cards,
      rankings: [...updatedPlayers].sort((a, b) => b.score - a.score).map((p) => p.name)
    })

    setReveal(null)
    if (settleTurn(reveal.playerIndex, updatedPlayers) === 'over') return
    nextTurn()
    addToast(msg(modesText).cardPlaced, 'success')
  }, [reveal, gameOver, players, settleTurn, nextTurn, updatePlayer, applyEffects, pushRanking, setReveal, addToast, book])

  // ── Bots ─────────────────────────────────────────────────────────────────
  // Effect events always see the latest placeCard/submitGuess (no stale closures).
  const onBotAction = useEffectEvent((action: BotAction) => {
    if (action.type === 'guess') submitGuess(action.data.title, action.data.artist, action.data.year)
    else placeCard(action.data.position)
  })
  const onBotError = useEffectEvent(() => {
    addToast(msg(modesText).botError, 'error')
    nextTurn()
  })

  const currentKey = currentSong ? songKey(currentSong) : null
  const botTurn = runBots && Boolean(activePlayer?.isBot) && (phase === 'placing' || phase === 'guessing')

  // A bot still listening when the game screen goes away must not play on
  const botAbort = useRef<AbortController | null>(null)
  useEffect(() => () => botAbort.current?.abort(), [])

  useEffect(() => {
    // botBusy: if the song changes while the bot is still thinking (someone
    // draws again), the re-run must not start a second bot turn.
    if (!botTurn || !activePlayer || !currentSong || botBusy.current) return
    botBusy.current = true
    setIsBotThinking(true)
    const bot = new BotPlayer(activePlayer)
    botAbort.current = new AbortController()
    bot
      .executeTurn(gameMode!, currentSong, activeTimeline, (action) => onBotAction(action), botAbort.current.signal)
      .catch(() => onBotError())
      .finally(() => {
        botBusy.current = false
        setIsBotThinking(false)
      })
    // activeTimeline/currentSong are read at the moment the bot starts thinking
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botTurn, currentKey, currentPlayer])

  return {
    phase,
    reveal,
    gameOver,
    isBotThinking,
    activePlayer,
    activeTimeline,
    pending,
    drawSong,
    placeCard,
    startChallenge,
    cancelChallenge,
    passChallenge,
    setObjectionDeadline,
    claimGap,
    revealPlacement,
    swapSong,
    submitGuess,
    skip,
    continueTurn,
    passTurn,
    markLeft
  }
}

export type TurnFlow = ReturnType<typeof useTurnFlow>
