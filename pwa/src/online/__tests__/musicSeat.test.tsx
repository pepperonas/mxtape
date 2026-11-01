import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { AppProviders } from '@/contexts'
import { audioRoleFor, musicSeat } from '../musicSeat'
import type { Player, Song } from '@/types'

const fake = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  state: 'idle',
  songId: null as string | null
}))

vi.mock('@/services/PreviewPlayerService', () => {
  const player = {
    setConfig: () => {},
    play: (song: { id: string }, at: number) => {
      fake.calls.push(['play', song.id, at])
      fake.state = 'playing'
      return Promise.resolve()
    },
    stop: () => {
      fake.calls.push(['stop'])
      fake.state = 'idle'
    },
    pause: () => fake.calls.push(['pause']),
    resume: () => fake.calls.push(['resume']),
    seek: () => {},
    preload: () => {},
    plannedStart: () => null,
    clearPreload: () => {},
    getState: () => fake.state,
    getCurrentTime: () => 0,
    getDuration: () => 200,
    getSongId: () => fake.songId
  }
  return { getPreviewPlayer: () => player }
})

// Imported after the mock
const { Turntable } = await import('@/components/game/Turntable')

const p = (name: string, seat: number, extra: Partial<Player> = {}) => ({ id: name, name, seat, cards: 0, score: 0, timeline: [], ...extra }) as unknown as Player
const players = [p('Host', 0), p('Lisa', 1), p('Tom', 2)]
const members = [
  { seat: 0, online: true, host: true },
  { seat: 1, online: true },
  { seat: 2, online: false }
]

describe('musicSeat — "together in the room"', () => {
  it('is the device of whoever is on turn', () => {
    expect(musicSeat(players, 1, [], members, 0)).toBe(1)
    expect(musicSeat(players, 0, [], members, 0)).toBe(0)
  })

  it('falls back to the host when that device cannot play', () => {
    expect(musicSeat(players, 2, [], members, 0)).toBe(0) // not connected
    expect(musicSeat(players, 1, [1], members, 0)).toBe(0) // skipped as absent
    expect(musicSeat([p('Host', 0), p('Lisa', 1, { left: true })], 1, [], members, 0)).toBe(0) // left
    expect(musicSeat(players, 5, [], members, 0)).toBe(0) // no such player
  })
})

describe('Turntable hands the music over', () => {
  const song = { id: 'song_001', title: 'T', artist: 'A', year: 1990, previewUrl: '/audio/song_001.m4a' } as unknown as Song
  beforeEach(() => {
    fake.calls.length = 0
    fake.state = 'idle'
  })

  const view = (role: 'host' | 'silent', cue: { songId: string; playing: boolean; positionMs: number; at: number } | null) => (
    <MotionTestProvider>
      <AppProviders>
        <Turntable song={song} audioRole={role} cue={cue} clockOffset={() => 0} musicAt="Lisa" />
      </AppProviders>
    </MotionTestProvider>
  )

  it('a silent device never plays, and names whose device has the music', () => {
    const { container } = render(view('silent', null))
    expect(fake.calls.filter((c) => c[0] === 'play')).toEqual([])
    expect(container.textContent).toContain('Lisa')
  })

  it('taking over continues from the last cue; handing over stops', () => {
    const now = Date.now()
    const cue = { songId: 'song_001', playing: true, positionMs: 30_000, at: now }
    const r = render(view('silent', cue))
    act(() => r.rerender(view('host', cue)))
    const play = fake.calls.find((c) => c[0] === 'play')!
    expect(play[1]).toBe('song_001')
    expect(play[2] as number).toBeGreaterThanOrEqual(30)
    expect(play[2] as number).toBeLessThan(32)
    act(() => r.rerender(view('silent', cue)))
    expect(fake.calls[fake.calls.length - 1]).toEqual(['stop'])
  })

  it('a paused song stays paused when it moves', () => {
    const cue = { songId: 'song_001', playing: false, positionMs: 30_000, at: Date.now() }
    const r = render(view('silent', cue))
    act(() => r.rerender(view('host', cue)))
    expect(fake.calls.filter((c) => c[0] === 'play')).toEqual([])
  })
})


describe('audioRoleFor — who plays the music', () => {
  const base = { mirror: false, online: true, screenOnline: false, music: 'room' as const, seat: 1, musicAtSeat: 1, isHost: false }
  it('a connected TV plays in every mode, everyone else is silent', () => {
    for (const music of ['room', 'everyone'] as const) {
      expect(audioRoleFor({ ...base, music, screenOnline: true, seat: 9, musicAtSeat: 9 })).toBe('host')
      expect(audioRoleFor({ ...base, music, screenOnline: true, seat: 0, musicAtSeat: 9, isHost: true })).toBe('silent')
      expect(audioRoleFor({ ...base, music, screenOnline: true, seat: 1, musicAtSeat: 9 })).toBe('silent')
    }
  })
  it('one device with a TV room: plays and reports until the TV is there, then silent', () => {
    expect(audioRoleFor({ ...base, mirror: true, online: false, screenOnline: false })).toBe('host')
    expect(audioRoleFor({ ...base, mirror: true, online: false, screenOnline: true })).toBe('silent')
  })
  it('without a TV nothing changes', () => {
    expect(audioRoleFor({ ...base, online: false })).toBe('local')
    expect(audioRoleFor({ ...base, music: 'everyone', isHost: true })).toBe('host')
    expect(audioRoleFor({ ...base, music: 'everyone' })).toBe('follow')
    expect(audioRoleFor({ ...base, musicAtSeat: 1, seat: 1 })).toBe('host')
    expect(audioRoleFor({ ...base, musicAtSeat: 0, seat: 1 })).toBe('silent')
  })
  it('musicSeat: an online screen gets the music', () => {
    expect(musicSeat(players, 1, [], [...members, { seat: 7, online: true, display: true }], 0)).toBe(7)
    expect(musicSeat(players, 1, [], [...members, { seat: 7, online: false, display: true }], 0)).toBe(1)
  })
})

describe('Turntable as a remote control (TV mode)', () => {
  const song = { id: 'song_002', title: 'T', artist: 'A', year: 1990, previewUrl: '/audio/song_002.m4a' } as unknown as Song
  beforeEach(() => {
    fake.calls.length = 0
    fake.state = 'idle'
    fake.songId = null
  })
  const wrap = (ui: React.ReactNode) => (
    <MotionTestProvider>
      <AppProviders>{ui}</AppProviders>
    </MotionTestProvider>
  )

  it('a silent phone keeps its play button, and it asks the TV', () => {
    const asked: boolean[] = []
    const cue = { songId: 'song_002', playing: true, positionMs: 5000, at: Date.now() }
    const r = render(wrap(<Turntable song={song} audioRole="silent" cue={cue} clockOffset={() => 0} musicOnScreen onRemoteToggle={(p) => asked.push(p)} />))
    const pause = r.getAllByRole('button', { name: 'Pause' })[0]
    act(() => pause.click())
    expect(asked).toEqual([false])
    expect(fake.calls.filter((c) => c[0] === 'play')).toEqual([])
    expect(r.container.textContent).toContain('am Bildschirm')
  })

  it('without a remote a silent device shows no play button', () => {
    const cue = { songId: 'song_002', playing: true, positionMs: 0, at: Date.now() }
    const r = render(wrap(<Turntable song={song} audioRole="silent" cue={cue} clockOffset={() => 0} musicAt="Lisa" />))
    expect(r.queryAllByRole('button', { name: 'Pause' })).toEqual([])
  })

  it('the TV carries out pause and play from the phone', () => {
    const r = render(wrap(<Turntable song={song} audioRole="host" remote={null} clockOffset={() => 0} />))
    fake.songId = 'song_002'
    fake.state = 'playing'
    act(() => r.rerender(wrap(<Turntable song={song} audioRole="host" remote={{ n: 1, playing: false }} clockOffset={() => 0} />)))
    expect(fake.calls[fake.calls.length - 1]).toEqual(['pause'])
    fake.state = 'paused'
    act(() => r.rerender(wrap(<Turntable song={song} audioRole="host" remote={{ n: 2, playing: true }} clockOffset={() => 0} />)))
    expect(fake.calls[fake.calls.length - 1]).toEqual(['resume'])
  })

  it('a TV switched on mid-song starts where the music of the room stands', () => {
    const cue = { songId: 'song_002', playing: true, positionMs: 42_000, at: Date.now() }
    render(wrap(<Turntable song={song} audioRole="host" cue={cue} clockOffset={() => 0} />))
    const play = fake.calls.find((c) => c[0] === 'play')!
    expect(play[2] as number).toBeGreaterThanOrEqual(42)
    expect(play[2] as number).toBeLessThan(44)
  })

  it('after the TV is gone the phone takes the music back where the TV was', () => {
    const cue = { songId: 'song_002', playing: true, positionMs: 60_000, at: Date.now() }
    const r = render(wrap(<Turntable song={song} audioRole="silent" cue={cue} clockOffset={() => 0} musicOnScreen onRemoteToggle={() => {}} />))
    // disconnecting drops the room: no cue any more, the role becomes local
    act(() => r.rerender(wrap(<Turntable song={song} audioRole="local" cue={null} clockOffset={() => 0} />)))
    const play = fake.calls.find((c) => c[0] === 'play')!
    expect(play[2] as number).toBeGreaterThanOrEqual(60)
  })
})
