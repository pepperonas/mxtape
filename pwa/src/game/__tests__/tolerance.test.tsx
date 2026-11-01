import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, useGame } from '@/contexts'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { fakeApiFetch } from '@/test/fakeApi'
import { AuthProvider } from '@/auth/AuthContext'
import { AuthGate } from '@/auth/AuthGate'
import { SetupScreen } from '@/screens/SetupScreen'
import { useTurnFlow } from '../useTurnFlow'
import { evaluatePlacement } from '../placement'
import { resolveChallenge } from '../challenge'
import { guessBreakdown, guessDetailsFor } from '../guess'
import { guessRecord } from '../turnRecord'
import { nextTolerance, scoredDifference, toleranceOf, TOLERANCE_STEPS } from '../tolerance'
import type { Song } from '@/types'

const song = (year: number, id = `s${year}`): Song => ({ id, title: `Song ${year}`, artist: 'Artist', year })
const line = [song(1970), song(1980), song(1990)]

describe('year handicap: the rules', () => {
  it('without one nothing changes', () => {
    expect(evaluatePlacement(line, song(1984), 2).isCorrect).toBe(true)
    expect(evaluatePlacement(line, song(1984), 1).isCorrect).toBe(false)
    expect(evaluatePlacement(line, song(1984), 1, 0)).toMatchObject({ isCorrect: false, byTolerance: false })
  })

  it('a card a few years outside its gap counts, and goes where it belongs', () => {
    // 1982 put between 1970 and 1980: 2 years off
    const two = evaluatePlacement(line, song(1982), 1, 2)
    expect(two).toMatchObject({ isCorrect: true, byTolerance: true })
    expect(two.newTimeline.map((s) => s.year)).toEqual([1970, 1980, 1982, 1990])
    expect(evaluatePlacement(line, song(1982), 1, 1).isCorrect).toBe(false)
    // before the first card / after the last one
    expect(evaluatePlacement(line, song(1972), 0, 3).isCorrect).toBe(true)
    expect(evaluatePlacement(line, song(1972), 0, 1).isCorrect).toBe(false)
    expect(evaluatePlacement(line, song(1987), 3, 3).newTimeline.map((s) => s.year)).toEqual([1970, 1980, 1987, 1990])
  })

  it('an exact placement is never marked as a handicap one', () => {
    expect(evaluatePlacement(line, song(1984), 2, 5)).toMatchObject({ isCorrect: true, byTolerance: false })
  })

  it('an objection judges each side with its own handicap', () => {
    // placer (no handicap) puts 1982 before 1980; the objector (±3) says before 1970 — 12 years off: wrong
    expect(resolveChallenge(line, song(1982), 1, { playerIndex: 1, gapIndex: 0 }, { placer: 0, challenger: 3 }).outcome).toBe('nobody')
    // the objector with ±2 claims the 1980–1990 gap… exact anyway; with a handicap the placer's 1982 between 1970 and 1980 holds
    expect(resolveChallenge(line, song(1982), 1, null, { placer: 2 })).toMatchObject({ placerCorrect: true, placerByTolerance: true, outcome: 'placer' })
    expect(resolveChallenge(line, song(1983), 1, { playerIndex: 1, gapIndex: 0 }, { placer: 2, challenger: 15 }).outcome).toBe('challenger')
  })

  it('hardcore: the year scores as if the handicap closer; the log keeps the real difference', () => {
    const check = { titleMatch: false, artistMatch: false, yearDifference: 3, tolerance: 2 }
    expect(guessBreakdown(check).year).toBe(2)
    expect(guessBreakdown({ ...check, tolerance: 3 }).year).toBe(5)
    expect(guessBreakdown({ ...check, tolerance: undefined }).year).toBe(0)
    expect(guessDetailsFor(check).yearPoints).toBe(2)
    const rec = guessRecord({ name: 'A', timeline: [], cards: 0, score: 0 }, song(1990), check, 2)
    expect(rec).toMatchObject({ d: 3, ok: true })
    expect(guessRecord({ name: 'A', timeline: [], cards: 0, score: 0 }, song(1990), { ...check, tolerance: 0 }, 0).ok).toBe(false)
    expect(scoredDifference(1, 5)).toBe(0)
  })

  it('bots never get one; values are clamped; the chip cycles through the steps', () => {
    expect(toleranceOf({ tolerance: 3, isBot: true })).toBe(0)
    expect(toleranceOf({ tolerance: 99 })).toBe(5)
    expect(toleranceOf({ tolerance: -2 })).toBe(0)
    expect(toleranceOf(undefined)).toBe(0)
    const seen = [0]
    for (let i = 0; i < TOLERANCE_STEPS.length; i++) seen.push(nextTolerance(seen[seen.length - 1]))
    expect(seen).toEqual([0, 1, 2, 3, 5, 0])
  })
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <MotionTestProvider>
    <AppProviders>{children}</AppProviders>
  </MotionTestProvider>
)

describe('year handicap in a round', () => {
  it('a placer with ±2 gets the card and the reveal says why', () => {
    const hook = renderHook(() => ({ game: useGame(), flow: useTurnFlow({ onGameOver: vi.fn(), onSkipNotice: vi.fn() }) }), { wrapper })
    const get = () => hook.result.current
    act(() => {
      get().game.setGameMode('timeline_personal' as never)
      get().game.addPlayer('Kid', { tolerance: 2 } as never)
      get().game.addPlayer('Dad')
    })
    act(() => get().game.updatePlayer(0, { timeline: [song(1970), song(1980), song(1990)], cards: 3, tolerance: 2 }))
    act(() => get().game.setCurrentSong(song(1982)))
    act(() => get().flow.placeCard(1))
    expect(get().flow.reveal).toMatchObject({ kind: 'placement', isCorrect: true, byTolerance: 2 })
    expect(get().game.players[0].cards).toBe(4)
    expect(get().game.players[0].timeline.map((s) => s.year)).toEqual([1970, 1980, 1982, 1990])
  })

  it('without it the same card is wrong', () => {
    const hook = renderHook(() => ({ game: useGame(), flow: useTurnFlow({ onGameOver: vi.fn(), onSkipNotice: vi.fn() }) }), { wrapper })
    const get = () => hook.result.current
    act(() => {
      get().game.setGameMode('timeline_personal' as never)
      get().game.addPlayer('Kid')
      get().game.addPlayer('Dad')
    })
    act(() => get().game.updatePlayer(0, { timeline: [song(1970), song(1980), song(1990)], cards: 3 }))
    act(() => get().game.setCurrentSong(song(1982)))
    act(() => get().flow.placeCard(1))
    expect(get().flow.reveal).toMatchObject({ isCorrect: false })
    expect(get().flow.reveal).not.toHaveProperty('byTolerance')
  })

  it('hardcore: the guess carries the guesser’s handicap', () => {
    const hook = renderHook(() => ({ game: useGame(), flow: useTurnFlow({ onGameOver: vi.fn(), onSkipNotice: vi.fn() }) }), { wrapper })
    const get = () => hook.result.current
    act(() => {
      get().game.setGameMode('hardcore' as never)
      get().game.addPlayer('Kid', { tolerance: 3 } as never)
      get().game.addPlayer('Dad')
    })
    act(() => get().game.updatePlayer(0, { tolerance: 3 }))
    act(() => get().game.setCurrentSong(song(1990)))
    act(() => get().flow.submitGuess('', '', '1993'))
    expect(get().flow.reveal).toMatchObject({ kind: 'guess', breakdown: { year: 5 } })
  })
})

describe('year handicap in the setup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('switching it on shows a chip per person; tapping cycles; switching off clears it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
        if (url === '/api/session')
          return json({ me: { id: 1, email: 'a@example.com', name: 'Anna', picture: '', status: 'approved', isAdmin: false, csrf: 't' } })
        if (url === '/api/songs/overrides') return json({ overrides: [] })
        return fakeApiFetch(input, init)
      })
    )
    let game: ReturnType<typeof useGame> | null = null
    const Peek = () => {
      game = useGame()
      return null
    }
    render(
      <MotionTestProvider>
        <MemoryRouter initialEntries={['/new']}>
          <AuthProvider>
            <AuthGate>
              <AppProviders>
                <SetupScreen />
                <Peek />
              </AppProviders>
            </AuthGate>
          </AuthProvider>
        </MemoryRouter>
      </MotionTestProvider>
    )
    const sw = (await screen.findByRole('switch', { name: 'Jahres-Ausgleich' })) as HTMLInputElement
    expect(screen.queryByRole('button', { name: /Ausgleich für Anna/ })).toBeNull()
    fireEvent.click(sw)
    const chip = await screen.findByRole('button', { name: /Ausgleich für Anna: keiner/ })
    fireEvent.click(chip)
    fireEvent.click(await screen.findByRole('button', { name: /Ausgleich für Anna: ±1 Jahr\./ }))
    await screen.findByRole('button', { name: /Ausgleich für Anna: ±2 Jahre/ })
    expect(game!.players.find((p) => p.name === 'Anna')?.tolerance).toBe(2)
    fireEvent.click(sw)
    await waitFor(() => expect(game!.players.find((p) => p.name === 'Anna')?.tolerance).toBe(0))
  })
})
