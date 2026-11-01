import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Howl } from 'howler'
import { PreviewPlayerService } from '../PreviewPlayerService'
import { poolKey, usableUpcoming } from '@/game/upcoming'
import type { Song } from '@/types'

const song = (id: string): Song => ({ id, title: id, artist: 'A', year: 1990, previewUrl: `https://mxtape.celox.io/audio/${id}.m4a` })

type Fake = {
  src: string[]
  handlers: Record<string, Array<(...a: unknown[]) => void>>
  play: ReturnType<typeof vi.fn>
  seek: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  state: ReturnType<typeof vi.fn>
  emit: (event: string) => void
}
let made: Fake[] = []

beforeEach(() => {
  made = []
  vi.mocked(Howl).mockImplementation((function (opts: { src: string[] }) {
    const handlers: Fake['handlers'] = {}
    const add = (e: string, fn: (...a: unknown[]) => void) => ((handlers[e] ??= []).push(fn), fake)
    let loaded = false
    let at = 0
    const fake = {
      src: opts.src,
      handlers,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      unload: vi.fn(),
      volume: vi.fn(),
      duration: vi.fn(() => 240),
      seek: vi.fn((to?: number) => (typeof to === 'number' ? ((at = to), fake) : at)),
      state: vi.fn(() => (loaded ? 'loaded' : 'loading')),
      on: add,
      once: add,
      off: vi.fn(),
      emit: (event: string) => {
        if (event === 'load') loaded = true
        handlers[event]?.forEach((fn) => fn())
      }
    }
    made.push(fake as unknown as Fake)
    return fake
  }) as never)
})

describe('preloading the next song', () => {
  it('loads the song silently and buffers it at its start point', () => {
    const p = new PreviewPlayerService()
    p.preload(song('song_002'), 42)
    expect(made).toHaveLength(1)
    expect(made[0].src).toEqual(['/audio/song_002.m4a'])
    expect(made[0].play).not.toHaveBeenCalled()
    made[0].emit('load')
    expect(made[0].seek).toHaveBeenCalledWith(42)
    expect(p.plannedStart('song_002')).toBe(42)
    expect(p.plannedStart('song_003')).toBeNull()
  })

  it('play() takes the loaded sound over instead of requesting the file again', () => {
    const states: string[] = []
    const p = new PreviewPlayerService({ onStateChange: (s) => states.push(s) })
    p.preload(song('song_002'), 42)
    made[0].emit('load')
    void p.play(song('song_002'), 42)
    expect(made).toHaveLength(1)
    expect(made[0].play).toHaveBeenCalledTimes(1)
    expect(p.getPreloadedId()).toBeNull()
    made[0].emit('play')
    expect(states[states.length - 1]).toBe('playing')
  })

  it('another song is loaded fresh; the one loaded ahead stays for later', () => {
    const p = new PreviewPlayerService()
    p.preload(song('song_002'), 0)
    void p.play(song('song_009'), 0)
    expect(made).toHaveLength(2)
    expect(made[1].src).toEqual(['/audio/song_009.m4a'])
    expect(p.getPreloadedId()).toBe('song_002')
  })

  it('stopping the song on the platter keeps the next one loaded (the reveal ends with a stop)', () => {
    const p = new PreviewPlayerService()
    void p.play(song('song_001'), 0)
    p.preload(song('song_002'), 0)
    p.stop()
    expect(p.getPreloadedId()).toBe('song_002')
    expect(made[1].unload).not.toHaveBeenCalled()
  })

  it('a new preload replaces the old one; clearPreload and destroy release it', () => {
    const p = new PreviewPlayerService()
    p.preload(song('song_002'), 0)
    p.preload(song('song_003'), 0)
    expect(made[0].unload).toHaveBeenCalled()
    p.clearPreload()
    expect(made[1].unload).toHaveBeenCalled()
    p.preload(song('song_004'), 0)
    p.destroy()
    expect(made[2].unload).toHaveBeenCalled()
  })

  it('events of a sound that is no longer on the platter change nothing', () => {
    const states: string[] = []
    const p = new PreviewPlayerService({ onStateChange: (s) => states.push(s) })
    void p.play(song('song_001'), 0)
    void p.play(song('song_002'), 0)
    states.length = 0
    made[0].emit('play')
    expect(states).toEqual([])
  })
})

describe('the song chosen ahead', () => {
  const draw = (id: string) => ({ song: song(id), widened: false })
  const key = poolKey({ decades: [1980, 1990], exotics: false })

  it('may be drawn while the options are the same and it was not played', () => {
    expect(usableUpcoming({ key, draw: draw('song_002') }, key, ['other'])).toMatchObject({ song: { id: 'song_002' } })
  })
  it('is dropped when the options changed', () => {
    const other = poolKey({ decades: [1980], exotics: false })
    expect(usableUpcoming({ key, draw: draw('song_002') }, other, [])).toBeNull()
  })
  it('is dropped when it was played in the meantime', () => {
    expect(usableUpcoming({ key, draw: draw('song_002') }, key, ['song_002'])).toBeNull()
  })
  it('the order of decades does not matter', () => {
    expect(poolKey({ decades: [1990, 1980], exotics: false })).toBe(key)
  })
})
