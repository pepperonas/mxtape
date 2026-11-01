import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppProviders, useAchievements, useGame, useGameHistory } from '@/contexts'
import { AchievementId } from '@/types/achievements'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { useTurnFlow, type SkipNotice } from '../useTurnFlow'
import { BotPlayer, BOT_LISTEN_MS } from '@/services/botPlayer'
import type { Player, Song } from '@/types'

const song = (year: number, id = `s${year}`): Song => ({ id, title: `Song ${year}`, artist: 'Artist', year })

const wrapper = ({ children }: { children: ReactNode }) => (
  <MotionTestProvider>
    <AppProviders>{children}</AppProviders>
  </MotionTestProvider>
)

function setup(mode: 'hardcore' | 'timeline_personal' | 'timeline_global', players: Array<Partial<Player> & { name: string }>) {
  const onGameOver = vi.fn()
  const notices: Array<{ notice: SkipNotice; ack: () => void }> = []
  const hook = renderHook(
    () => {
      const game = useGame()
      const flow = useTurnFlow({ onGameOver, onSkipNotice: (notice, ack) => notices.push({ notice, ack }) })
      return { game, flow }
    },
    { wrapper }
  )
  act(() => {
    hook.result.current.game.setGameMode(mode as never)
    players.forEach(({ name, ...data }) => hook.result.current.game.addPlayer(name, data as never))
  })
  players.forEach((p, i) => {
    const { name: _name, ...data } = p
    if (Object.keys(data).length) act(() => hook.result.current.game.updatePlayer(i, data))
  })
  return { ...hook, onGameOver, notices, get: () => hook.result.current }
}

// Bots listen 3–6 s in the game; the flow tests do not wait that long
const LISTEN = { ...BOT_LISTEN_MS }
beforeEach(() => {
  localStorage.clear()
  Object.assign(BOT_LISTEN_MS, { min: 50, max: 80 })
})
afterAll(() => Object.assign(BOT_LISTEN_MS, LISTEN))
afterEach(() => vi.restoreAllMocks())

describe('timeline modes', () => {
  it('first card: placing → revealed (correct) → next player, credited on placement', () => {
    const t = setup('timeline_personal', [{ name: 'A' }, { name: 'B' }])
    expect(t.get().flow.phase).toBe('idle')

    act(() => t.get().game.setCurrentSong(song(1985)))
    expect(t.get().flow.phase).toBe('placing')

    act(() => t.get().flow.placeCard(0))
    expect(t.get().flow.phase).toBe('revealed')
    expect(t.get().flow.reveal).toMatchObject({ kind: 'placement', isCorrect: true, isFirstCard: true, cardsAfter: 1 })
    // credited immediately (before "Nächster Spieler")
    expect(t.get().game.players[0]).toMatchObject({ cards: 1 })
    expect(t.get().game.players[0].timeline.map((s) => s.year)).toEqual([1985])

    act(() => t.get().flow.continueTurn())
    expect(t.get().game.currentPlayer).toBe(1)
    expect(t.get().game.currentSong).toBeNull()
    expect(t.get().flow.phase).toBe('idle')
  })

  it('wrong placement changes nothing but the turn', () => {
    const t = setup('timeline_personal', [{ name: 'A', timeline: [song(1970), song(1990)], cards: 2 }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(2005)))
    act(() => t.get().flow.placeCard(0))
    expect(t.get().flow.reveal).toMatchObject({ isCorrect: false, cardsAfter: 2 })
    expect(t.get().game.players[0]).toMatchObject({ cards: 2 })
    expect(t.get().game.players[0].timeline).toHaveLength(2)
    act(() => t.get().flow.continueTurn())
    expect(t.get().game.currentPlayer).toBe(1)
  })

  it('ignores placements outside the placing phase', () => {
    const t = setup('timeline_personal', [{ name: 'A' }])
    act(() => t.get().flow.placeCard(0))
    expect(t.get().flow.reveal).toBeNull()
  })

  it('the 10th correct card wins on continue', () => {
    const tl = Array.from({ length: 9 }, (_, i) => song(1950 + i * 5))
    const t = setup('timeline_personal', [{ name: 'A', timeline: tl, cards: 9 }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(2020)))
    act(() => t.get().flow.placeCard(9))
    expect(t.onGameOver).not.toHaveBeenCalled()
    act(() => t.get().flow.continueTurn())
    expect(t.onGameOver).toHaveBeenCalledTimes(1)
    expect(t.onGameOver.mock.calls[0][0]).toMatchObject({ name: 'A', cards: 10 })
    expect(t.get().flow.phase).toBe('over')
    // no further turn after the game ended
    expect(t.get().game.currentPlayer).toBe(0)
  })

  it('global mode adds to the shared, sorted timeline', () => {
    const t = setup('timeline_global', [{ name: 'A' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1990)))
    act(() => t.get().flow.placeCard(0))
    act(() => t.get().flow.continueTurn())
    act(() => t.get().game.setCurrentSong(song(1970)))
    expect(t.get().flow.activeTimeline.map((s) => s.year)).toEqual([1990])
    act(() => t.get().flow.placeCard(0))
    expect(t.get().game.globalTimeline.map((c) => [c.song.year, c.playerId])).toEqual([
      [1970, 1],
      [1990, 0]
    ])
    expect(t.get().game.players.map((p) => p.cards)).toEqual([1, 1])
  })
})

describe('hardcore', () => {
  it('reveals the breakdown and credits card + points only on continue', () => {
    const t = setup('hardcore', [{ name: 'A' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1984)))
    expect(t.get().flow.phase).toBe('guessing')

    act(() => t.get().flow.submitGuess('Song 1984', 'Artist', '1985'))
    expect(t.get().flow.reveal).toMatchObject({ kind: 'guess', breakdown: { title: 5, artist: 5, year: 2, total: 12 } })
    expect(t.get().game.players[0]).toMatchObject({ score: 0, cards: 0 })

    act(() => t.get().flow.continueTurn())
    const a = t.get().game.players[0]
    expect(a).toMatchObject({ score: 12, cards: 1 })
    expect(a.timeline[0]).toMatchObject({ points: 12, guessDetails: { titleCorrect: true, artistCorrect: true, yearPoints: 2 } })
    expect(t.get().game.currentPlayer).toBe(1)
    expect(t.get().flow.phase).toBe('idle')
  })

  it('ends the game with the final snapshot (including the last card)', () => {
    const tl = Array.from({ length: 9 }, (_, i) => song(1960 + i))
    const t = setup('hardcore', [
      { name: 'A', timeline: tl, cards: 9, score: 40 },
      { name: 'B', timeline: tl, cards: 10, score: 30 }
    ])
    act(() => t.get().game.setCurrentSong(song(1999)))
    act(() => t.get().flow.submitGuess('x', 'y', '1999'))
    act(() => t.get().flow.continueTurn())
    expect(t.onGameOver).toHaveBeenCalledTimes(1)
    const [winner, finalPlayers] = t.onGameOver.mock.calls[0] as [Player, Player[]]
    expect(winner).toMatchObject({ name: 'A', score: 45, cards: 10 })
    expect(finalPlayers[0].timeline).toHaveLength(10)
  })

  it('skips: free → danger zone → penalty draws a fresh song for the next player', () => {
    const t = setup('hardcore', [{ name: 'A', score: 10 }, { name: 'B', score: 10 }])
    act(() => t.get().game.setCurrentSong(song(1980, 'first')))

    act(() => t.get().flow.skip()) // A skips — free, B gets the same song
    expect(t.notices).toHaveLength(0)
    expect(t.get().game.currentPlayer).toBe(1)
    expect(t.get().game.currentSong?.id).toBe('first')

    act(() => t.get().flow.skip()) // B skips — everybody has skipped: danger zone
    expect(t.notices[0].notice).toMatchObject({ kind: 'danger' })
    act(() => t.notices[0].ack())
    expect(t.get().game.currentPlayer).toBe(0)

    vi.spyOn(Math, 'random').mockReturnValue(0) // force the penalty roll
    act(() => t.get().flow.skip())
    expect(t.notices[1].notice).toMatchObject({ kind: 'penalty', newScore: 7 })
    expect(t.get().game.players[0].score).toBe(7)
    act(() => t.notices[1].ack())
    expect(t.get().game.currentPlayer).toBe(1)
    // the promised fresh song really arrives for the next player
    expect(t.get().game.currentSong).not.toBeNull()
    expect(t.get().game.currentSong?.id).not.toBe('first')
  })
})

describe('bots', () => {
  it('a bot places exactly once per song through the same rules', async () => {
    const exec = vi
      .spyOn(BotPlayer.prototype, 'executeTurn')
      .mockImplementation(async (_mode, _song, _timeline, done) => done({ type: 'place', data: { position: 0 } }))
    const t = setup('timeline_personal', [{ name: 'Bot', isBot: true, botDifficulty: 'easy' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1977)))
    await waitFor(() => expect(t.get().flow.phase).toBe('revealed'))
    expect(exec).toHaveBeenCalledTimes(1)
    expect(t.get().game.players[0]).toMatchObject({ cards: 1 })
    t.rerender()
    t.rerender()
    expect(exec).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(t.get().flow.isBotThinking).toBe(false))
  })

  it('a song change while the bot is thinking does not start a second bot turn', async () => {
    let release!: () => void
    const thinking = new Promise<void>((r) => (release = r))
    const exec = vi.spyOn(BotPlayer.prototype, 'executeTurn').mockImplementation(async (_m, _s, _t, done) => {
      await thinking
      done({ type: 'place', data: { position: 0 } })
    })
    const t = setup('timeline_personal', [{ name: 'Bot', isBot: true, botDifficulty: 'easy' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1977, 'a')))
    await waitFor(() => expect(t.get().flow.isBotThinking).toBe(true))
    act(() => t.get().game.setCurrentSong(song(1988, 'b'))) // deps change mid-think
    await act(async () => release())
    await waitFor(() => expect(t.get().flow.phase).toBe('revealed'))
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('a bot guesses in hardcore', async () => {
    vi.spyOn(BotPlayer.prototype, 'executeTurn').mockImplementation(async (_m, s, _t, done) =>
      done({ type: 'guess', data: { title: s.title, artist: '', year: String(s.year) } })
    )
    const t = setup('hardcore', [{ name: 'Bot', isBot: true, botDifficulty: 'hard' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1991)))
    await waitFor(() => expect(t.get().flow.reveal).toMatchObject({ kind: 'guess', breakdown: { total: 10 } }))
  })

  it('a bot error skips the turn', async () => {
    vi.spyOn(BotPlayer.prototype, 'executeTurn').mockRejectedValue(new Error('boom'))
    const t = setup('timeline_personal', [{ name: 'Bot', isBot: true, botDifficulty: 'easy' }, { name: 'B' }])
    act(() => t.get().game.setCurrentSong(song(1960)))
    await waitFor(() => expect(t.get().game.currentPlayer).toBe(1))
  })
})

describe('no draw: tiebreak ("Stechen")', () => {
  const seed = (t: ReturnType<typeof setup>) =>
    act(() =>
      t.get().game.loadGameState({
        globalTimeline: [
          { song: song(1970, 'g1'), playerId: 0 },
          { song: song(1990, 'g2'), playerId: 1 }
        ]
      })
    )
  const place = (t: ReturnType<typeof setup>, year: number, gap: number) => {
    act(() => t.get().game.setCurrentSong(song(year, `t${year}-${gap}-${Math.random()}`)))
    act(() => t.get().flow.placeCard(gap))
    act(() => t.get().flow.continueTurn())
  }

  it('5:5 in the shared timeline does not end the game; the tied players play it out', () => {
    const t = setup('timeline_global', [{ name: 'Martin', cards: 5 }, { name: 'Bot Alpha', cards: 4 }])
    seed(t)
    act(() => t.get().game.setCurrentPlayer(1))
    place(t, 1980, 1) // Bot Alpha: correct → 5:5, 10 cards in total
    expect(t.onGameOver).not.toHaveBeenCalled()
    expect(t.get().game.tiebreak).toMatchObject({ contenders: [0, 1], round: 1 })
    expect(t.get().game.currentPlayer).toBe(0)

    place(t, 2005, 0) // Martin: wrong — round not complete yet, no decision
    expect(t.onGameOver).not.toHaveBeenCalled()
    expect(t.get().game.currentPlayer).toBe(1)

    place(t, 1975, 1) // Bot Alpha: correct → 5:6 after a full round
    expect(t.onGameOver).toHaveBeenCalledTimes(1)
    expect(t.onGameOver.mock.calls[0][0]).toMatchObject({ name: 'Bot Alpha', cards: 6 })
    expect(t.get().game.tiebreak).toBeNull()
  })

  it('both right again: another round; only contenders take turns', () => {
    const t = setup('timeline_global', [{ name: 'A', cards: 4 }, { name: 'B', cards: 2 }, { name: 'C', cards: 3 }])
    seed(t)
    act(() => t.get().game.setCurrentPlayer(2))
    place(t, 1980, 1) // C: 4 → A and C level at 4, total 10
    expect(t.get().game.tiebreak?.contenders).toEqual([0, 2])
    expect(t.get().game.currentPlayer).toBe(0) // B is skipped
    place(t, 1985, 2) // A right
    expect(t.get().game.currentPlayer).toBe(2)
    place(t, 1972, 1) // C right → 5:5
    expect(t.onGameOver).not.toHaveBeenCalled()
    expect(t.get().game.tiebreak).toMatchObject({ contenders: [0, 2], played: [], round: 2 })
    expect(t.get().game.currentPlayer).toBe(0)
  })

  it('hardcore: equal points after the last card lead to a tiebreak, not a coin flip; no skipping', () => {
    const tl = Array.from({ length: 9 }, (_, i) => song(1960 + i))
    const t = setup('hardcore', [
      { name: 'A', timeline: [...tl, song(1999, 'x')], cards: 10, score: 40 },
      { name: 'B', timeline: tl, cards: 9, score: 30 }
    ])
    act(() => t.get().game.setCurrentPlayer(1))
    act(() => t.get().game.setCurrentSong(song(1984, 'b10')))
    act(() => t.get().flow.submitGuess('Song 1984', 'Artist', '1999')) // +10 → 40:40
    act(() => t.get().flow.continueTurn())
    expect(t.onGameOver).not.toHaveBeenCalled()
    expect(t.get().game.tiebreak?.contenders).toEqual([0, 1])

    act(() => t.get().game.setCurrentSong(song(1977, 'tb1')))
    act(() => t.get().flow.skip())
    expect(t.get().game.currentPlayer).toBe(0) // skip ignored in a tiebreak
    act(() => t.get().flow.submitGuess('Song 1977', '', '1977')) // A +10
    act(() => t.get().flow.continueTurn())
    act(() => t.get().game.setCurrentSong(song(1966, 'tb2')))
    act(() => t.get().flow.submitGuess('', '', '1950')) // B +0
    act(() => t.get().flow.continueTurn())
    expect(t.onGameOver).toHaveBeenCalledTimes(1)
    expect(t.onGameOver.mock.calls[0][0]).toMatchObject({ name: 'A', score: 50 })
  })

  it('a rematch leaves out who left the room, and starts everyone afresh', () => {
    const t = setup('timeline_personal', [{ name: 'A', cards: 4 }, { name: 'B', cards: 2 }, { name: 'C', cards: 3 }])
    act(() => t.get().game.updatePlayer(1, { left: true }))
    act(() => t.get().game.rematch())
    expect(t.get().game.players.map((p) => [p.name, p.cards, Boolean(p.left)])).toEqual([
      ['A', 0, false],
      ['C', 0, false]
    ])
  })

  it('in a rematch whoever came last starts', () => {
    const t = setup('timeline_personal', [{ name: 'A', cards: 5 }, { name: 'B', cards: 1 }, { name: 'C', cards: 3 }])
    act(() => t.get().game.setCurrentPlayer(0))
    act(() => t.get().game.rematch('A'))
    expect(t.get().game.currentPlayer).toBe(1)
    expect(t.get().game.players[1].name).toBe('B')
  })

  it('in a hardcore rematch the fewest points start; leavers are out of the count', () => {
    const t = setup('hardcore', [{ name: 'A', score: 40 }, { name: 'B', score: 5 }, { name: 'C', score: 20 }])
    act(() => t.get().game.updatePlayer(1, { left: true }))
    act(() => t.get().game.rematch('A'))
    expect(t.get().game.players.map((p) => p.name)).toEqual(['A', 'C'])
    expect(t.get().game.currentPlayer).toBe(1)
  })

  it('a rematch starts without a tiebreak', () => {
    const t = setup('timeline_global', [{ name: 'A', cards: 5 }, { name: 'B', cards: 4 }])
    seed(t)
    act(() => t.get().game.setCurrentPlayer(1))
    place(t, 1980, 1)
    expect(t.get().game.tiebreak).not.toBeNull()
    act(() => t.get().game.rematch())
    expect(t.get().game.tiebreak).toBeNull()
  })
})

describe('Einspruch', () => {
  const base = [song(1970), song(1990)]

  it('waits face down while someone may object; no objection reveals as usual', () => {
    const t = setup('timeline_personal', [
      { name: 'A', timeline: base, cards: 2, challenges: 3 },
      { name: 'B', challenges: 3 }
    ])
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(1))
    expect(t.get().flow.phase).toBe('challenge')
    expect(t.get().game.players[0].cards).toBe(2) // nothing credited yet
    expect(t.get().flow.pending).toMatchObject({ playerIndex: 0, gapIndex: 1, challengers: [1] })

    act(() => t.get().flow.revealPlacement())
    expect(t.get().flow.reveal).toMatchObject({ isCorrect: true, challenge: null, cardsAfter: 3 })
    expect(t.get().game.players[0].cards).toBe(3)
    expect(t.get().game.players[1].challenges).toBe(3)
  })

  it('a right objection against a wrong card takes the card and costs one objection', () => {
    const t = setup('timeline_personal', [
      { name: 'A', timeline: base, cards: 2 },
      { name: 'B', challenges: 3 }
    ])
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(0)) // wrong: before 1970
    act(() => t.get().flow.startChallenge(1))
    act(() => t.get().flow.claimGap(0)) // the placer's own gap is not allowed
    expect(t.get().flow.phase).toBe('challenge')
    act(() => t.get().flow.claimGap(1))

    expect(t.get().flow.reveal).toMatchObject({ isCorrect: false, challenge: { playerIndex: 1, isCorrect: true, won: true } })
    expect(t.get().game.players[0].cards).toBe(2)
    expect(t.get().game.players[1]).toMatchObject({ cards: 1, challenges: 2 })
    expect(t.get().game.players[1].timeline.map((s) => s.year)).toEqual([1980])
  })

  it('a wrong objection against a right card only costs the objection', () => {
    const t = setup('timeline_global', [
      { name: 'A', cards: 0 },
      { name: 'B', challenges: 1 }
    ])
    act(() => t.get().game.addToGlobalTimeline(song(1970), 0))
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(1))
    act(() => t.get().flow.startChallenge(1))
    act(() => t.get().flow.claimGap(0))
    expect(t.get().flow.reveal).toMatchObject({ isCorrect: true, challenge: { won: false, isCorrect: false } })
    expect(t.get().game.players[0].cards).toBe(1)
    expect(t.get().game.players[1]).toMatchObject({ cards: 0, challenges: 0 })
    expect(t.get().game.globalTimeline.map((c) => c.playerId)).toEqual([0, 0])
  })

  it('on the shared timeline a won objection credits the card to the challenger', () => {
    const t = setup('timeline_global', [{ name: 'A' }, { name: 'B', challenges: 2 }])
    act(() => t.get().game.addToGlobalTimeline(song(1970), 0))
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(0))
    act(() => t.get().flow.startChallenge(1))
    act(() => t.get().flow.claimGap(1))
    expect(t.get().game.globalTimeline.map((c) => [c.song.year, c.playerId])).toEqual([
      [1970, 0],
      [1980, 1]
    ])
    expect(t.get().game.players[1].cards).toBe(1)
  })

  it('without objections left, a card is revealed straight away', () => {
    const t = setup('timeline_personal', [{ name: 'A', timeline: base, cards: 2 }, { name: 'B', challenges: 0 }])
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(1))
    expect(t.get().flow.phase).toBe('revealed')
  })
})

describe('round options', () => {
  it('a shorter round ends at its goal', () => {
    const t = setup('timeline_personal', [{ name: 'A', timeline: [song(1970)], cards: 4 }, { name: 'B' }])
    act(() => t.get().game.setOptions({ goal: 5 }))
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(1))
    act(() => t.get().flow.continueTurn())
    expect(t.onGameOver).toHaveBeenCalledTimes(1)
    expect(t.get().flow.phase).toBe('over')
  })

  it('draws only from the chosen decades', () => {
    const t = setup('timeline_personal', [{ name: 'A' }, { name: 'B' }])
    act(() => t.get().game.setOptions({ decades: [1980] }))
    for (let i = 0; i < 5; i++) {
      let drawn: Song | null = null
      act(() => {
        drawn = t.get().flow.drawSong()
      })
      expect(Math.floor(drawn!.year / 10) * 10).toBe(1980)
      act(() => t.get().game.setCurrentSong(null))
    }
  })

  it('a team hands the controls to the next member after its turn', () => {
    const t = setup('timeline_personal', [
      { name: 'Team Magenta', members: ['Anna', 'Ben'], memberTurn: 0 },
      { name: 'Team Orange', members: ['Cem', 'Dana'], memberTurn: 0 }
    ])
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(0))
    act(() => t.get().flow.continueTurn())
    expect(t.get().game.players[0].memberTurn).toBe(1)
    expect(t.get().game.players[1].memberTurn).toBe(0)
    expect(t.get().game.currentPlayer).toBe(1)
  })
})

describe('resume after reload', () => {
  it('a running round is restored from this device, mid-turn', () => {
    const t = setup('timeline_personal', [{ name: 'A' }, { name: 'B' }])
    act(() => t.get().game.startGame())
    act(() => t.get().game.setCurrentSong(song(1980)))
    act(() => t.get().flow.placeCard(0))
    expect(t.get().flow.phase).toBe('revealed')
    t.unmount()

    const again = renderHook(
      () => ({ game: useGame(), flow: useTurnFlow({ onGameOver: vi.fn(), onSkipNotice: vi.fn() }) }),
      { wrapper }
    )
    expect(again.result.current.game.isGameStarted).toBe(true)
    expect(again.result.current.flow.phase).toBe('revealed')
    expect(again.result.current.game.players[0].cards).toBe(1) // credited once, not twice
    act(() => again.result.current.flow.continueTurn())
    expect(again.result.current.game.currentPlayer).toBe(1)
  })

  it('a reset round is not restored', () => {
    const t = setup('timeline_personal', [{ name: 'A' }, { name: 'B' }])
    act(() => t.get().game.startGame())
    act(() => t.get().game.resetGame())
    t.unmount()
    const again = renderHook(() => useGame(), { wrapper })
    expect(again.result.current.isGameStarted).toBe(false)
  })
})

describe('turn log for the statistics', () => {
  function setupWithHistory(mode: 'hardcore' | 'timeline_personal', players: Array<Partial<Player> & { name: string }>) {
    const hook = renderHook(
      () => ({ game: useGame(), flow: useTurnFlow({ onGameOver: () => {}, onSkipNotice: () => {} }), history: useGameHistory() }),
      { wrapper }
    )
    act(() => {
      hook.result.current.game.setGameMode(mode as never)
      players.forEach(({ name }) => hook.result.current.game.addPlayer(name))
    })
    players.forEach(({ name: _n, ...data }, i) => {
      if (Object.keys(data).length) act(() => hook.result.current.game.updatePlayer(i, data))
    })
    return { get: () => hook.result.current }
  }

  it('books every turn, wrong ones and objections included, and stores them with the round', () => {
    const tl = Array.from({ length: 9 }, (_, i) => song(1950 + i * 5))
    const t = setupWithHistory('timeline_personal', [
      { name: 'A', timeline: tl, cards: 9 },
      { name: 'B', challenges: 3 }
    ])
    // A places wrong, B objects right
    act(() => t.get().game.setCurrentSong(song(1952, 'x')))
    act(() => t.get().flow.placeCard(9))
    act(() => t.get().flow.startChallenge(1))
    act(() => t.get().flow.claimGap(1))
    act(() => t.get().flow.continueTurn())
    expect(t.get().game.turnLog).toEqual([{ p: 'A', s: 'x', y: 1952, ok: false, ch: { by: 'B', ok: true } }])
    // B: now owns the 1952 card (won objection), places 1990 after it
    act(() => t.get().game.setCurrentSong(song(1990, 'y')))
    act(() => t.get().flow.placeCard(1))
    act(() => t.get().flow.revealPlacement())
    act(() => t.get().flow.continueTurn())
    // A wins with the 10th card
    act(() => t.get().game.setCurrentSong(song(2020, 'z')))
    act(() => t.get().flow.placeCard(9))
    act(() => t.get().flow.revealPlacement())
    act(() => t.get().flow.continueTurn())

    const saved = t.get().history.history[0]
    expect(saved.turns?.map((r) => [r.p, r.s, r.ok, Boolean(r.first)])).toEqual([
      ['A', 'x', false, false],
      ['B', 'y', true, false],
      ['A', 'z', true, false]
    ])
    // The round was never started through startGame, so its length is unknown and not stored
    expect('durationMs' in saved).toBe(false)
  })

  it('hardcore books the year distance and the points', () => {
    const tl = Array.from({ length: 9 }, (_, i) => song(1960 + i))
    const t = setupWithHistory('hardcore', [
      { name: 'A', timeline: tl, cards: 9, score: 40 },
      { name: 'B', timeline: tl, cards: 10, score: 30 }
    ])
    act(() => t.get().game.setCurrentSong(song(1999, 'q')))
    act(() => t.get().flow.submitGuess('Song 1999', 'nope', '1996'))
    act(() => t.get().flow.continueTurn())
    expect(t.get().history.history[0].turns).toEqual([{ p: 'A', s: 'q', y: 1999, ok: false, d: 3, ti: true, ar: false, pts: 5 }])
  })
})

describe('achievements', () => {
  it('a timeline round credits its people at the end (it used to be hardcore only) and never a bot', () => {
    const hook = renderHook(
      () => ({ game: useGame(), flow: useTurnFlow({ onGameOver: () => {}, onSkipNotice: () => {} }), ach: useAchievements() }),
      { wrapper }
    )
    const get = () => hook.result.current
    act(() => {
      get().game.setGameMode('timeline_personal' as never)
      get().game.addPlayer('A')
      get().game.addPlayer('Bot Alpha', { isBot: true, botDifficulty: 'easy' } as never)
    })
    const tl = Array.from({ length: 9 }, (_, i) => song(1950 + i * 5))
    act(() => get().game.updatePlayer(0, { timeline: tl, cards: 9 }))
    act(() => get().game.setCurrentSong(song(2020, 'z')))
    act(() => get().flow.placeCard(9))
    act(() => get().flow.continueTurn())
    expect(get().flow.phase).toBe('over')
    const a = get().ach.getPlayerAchievements('A')
    expect(a.find((x) => x.id === AchievementId.MARATHON_RUNNER)?.progress).toBe(1)
    expect(a.find((x) => x.id === AchievementId.PERFECTIONIST)?.unlocked).toBe(false)
    expect(get().ach.getAllPlayerNames()).not.toContain('Bot Alpha')
  })
})

describe('daily round options', () => {
  it('do not carry over into the next setup after a reset', () => {
    const t = setup('timeline_personal', [{ name: 'A' }])
    act(() => t.get().game.setOptions({ goal: 15, challengesEnabled: true, bonus: true }))
    act(() => t.get().game.resetGame())
    expect(t.get().game).toMatchObject({ goal: 15, bonus: true })
    // a daily round: fixed goal, no objections
    act(() => t.get().game.setOptions({ goal: 99, challengesEnabled: false, daily: '2026-10-28', songIds: ['song_001'] }))
    act(() => t.get().game.resetGame())
    const g = t.get().game
    expect(g.goal).not.toBe(99)
    expect(g.challengesEnabled).toBe(true)
    expect(g.daily).toBeNull()
    expect(g.songIds).toBeNull()
  })
})

describe('daily round: until the first wrong card, booked on the server song by song', () => {
  it('reports each song after the start card in order and ends at the first miss', async () => {
    const { songById } = await import('@/data/catalogue')
    const { dailySongs } = await import('../daily')
    const { songs } = await import('@/data/songs')
    const list = dailySongs('2026-10-28', songs)
    const posts: Array<{ url: string; body: unknown }> = []
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/daily/')) {
          posts.push({ url, body: JSON.parse(String(init?.body ?? 'null')) })
          return new Response('{}', { status: 200 })
        }
        return realFetch(input, init)
      })
    )
    const t = setup('timeline_personal', [{ name: 'A' }])
    act(() => t.get().game.setOptions({ goal: 99, challengesEnabled: false, daily: '2026-10-28', songIds: list.map((s) => s.id) }))
    act(() => t.get().game.startGame())
    // the gap where a song belongs on A's timeline
    const rightGap = () => {
      const year = songById(t.get().game.currentSong!.id)!.year
      return t.get().game.players[0].timeline.filter((s) => s.year < year).length
    }
    // start card, then two right
    for (let i = 0; i < 3; i++) {
      act(() => void t.get().flow.drawSong())
      act(() => t.get().flow.placeCard(rightGap()))
      expect(t.get().flow.reveal).toMatchObject({ isCorrect: true })
      act(() => t.get().flow.continueTurn())
      expect(t.get().flow.phase).not.toBe('over')
    }
    // then a wrong one: the run is over
    act(() => void t.get().flow.drawSong())
    const right = rightGap()
    const len = t.get().game.players[0].timeline.length
    act(() => t.get().flow.placeCard(right === 0 ? len : 0))
    act(() => t.get().flow.continueTurn())
    expect(t.get().flow.phase).toBe('over')
    await waitFor(() => expect(posts.length).toBe(3))
    expect(posts.map((p) => p.url)).toEqual(Array(3).fill('/api/daily/2026-10-28/turn'))
    expect(posts.map((p) => p.body)).toEqual([
      { index: 0, ok: true },
      { index: 1, ok: true },
      { index: 2, ok: false }
    ])
    vi.unstubAllGlobals()
  })
})

describe('the next song is loaded ahead', () => {
  async function prefetchSetup(canPrefetch: () => boolean) {
    const { getPreviewPlayer } = await import('@/services/PreviewPlayerService')
    const preload = vi.spyOn(getPreviewPlayer(), 'preload').mockImplementation(() => {})
    const hook = renderHook(
      () => {
        const game = useGame()
        const flow = useTurnFlow({ onGameOver: vi.fn(), onSkipNotice: vi.fn(), canPrefetch })
        return { game, flow }
      },
      { wrapper }
    )
    act(() => {
      hook.result.current.game.setGameMode('timeline_personal' as never)
      hook.result.current.game.addPlayer('A')
      hook.result.current.game.addPlayer('B')
    })
    return { preload, get: () => hook.result.current }
  }

  it('while waiting to draw, and the draw takes exactly that song', async () => {
    const t = await prefetchSetup(() => true)
    await waitFor(() => expect(t.preload).toHaveBeenCalled())
    const ahead = t.preload.mock.calls[t.preload.mock.calls.length - 1][0] as Song
    let drawn: Song | null = null
    act(() => {
      drawn = t.get().flow.drawSong()
    })
    expect(drawn!.id).toBe(ahead.id)
  })

  it('after the reveal, for the next turn — a different song', async () => {
    const t = await prefetchSetup(() => true)
    act(() => {
      t.get().flow.drawSong()
    })
    const first = t.get().game.currentSong!
    t.preload.mockClear()
    act(() => t.get().flow.placeCard(0))
    expect(t.get().flow.phase).toBe('revealed')
    await waitFor(() => expect(t.preload).toHaveBeenCalled())
    const next = t.preload.mock.calls[t.preload.mock.calls.length - 1][0] as Song
    expect(next.id).not.toBe(first.id)
    act(() => t.get().flow.continueTurn())
    act(() => {
      t.get().flow.drawSong()
    })
    expect(t.get().game.currentSong!.id).toBe(next.id)
  })

  it('nothing is loaded on a device without the music', async () => {
    const t = await prefetchSetup(() => false)
    act(() => {
      t.get().flow.drawSong()
    })
    act(() => t.get().flow.placeCard(0))
    await new Promise((r) => setTimeout(r, 20))
    expect(t.preload).not.toHaveBeenCalled()
  })
})
