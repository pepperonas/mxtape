import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, fireEvent, act } from '@testing-library/react'
import { SpotifyHold } from '../SpotifyHold'
import { HOLD_MS } from '@/hooks/useLongPress'
import { spotifyUrl } from '@/utils/spotify'
import type { Song } from '@/types'

const song = { id: 'song_000', title: 'Never Gonna Give You Up', artist: 'Rick Astley', year: 1987, spotifyId: '4PTG3Z6ehGkBFwjybzWkR8' } as Song

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('spotifyUrl', () => {
  it('opens the track itself when the song carries a real Spotify id', () => {
    expect(spotifyUrl(song)).toBe('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8')
  })
  it('otherwise searches for artist and title', () => {
    expect(spotifyUrl({ title: 'Last Christmas', artist: 'Wham!' })).toBe('https://open.spotify.com/search/Wham!%20Last%20Christmas')
    expect(spotifyUrl({ title: 'A & B', artist: 'C', spotifyId: 'nope' })).toBe('https://open.spotify.com/search/C%20A%20%26%20B')
  })
})

describe('holding an album cover', () => {
  const view = () => {
    vi.useFakeTimers()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { container } = render(
      <SpotifyHold song={song}>
        <img alt="" />
      </SpotifyHold>
    )
    return { el: container.querySelector('[data-spotify-hold]')!, open }
  }
  const down = (el: Element, x = 10, y = 10) => fireEvent.pointerDown(el, { button: 0, clientX: x, clientY: y })

  it('opens the song in Spotify after a long press', () => {
    const { el, open } = view()
    down(el)
    act(() => void vi.advanceTimersByTime(HOLD_MS - 10))
    expect(open).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(20))
    expect(open).toHaveBeenCalledWith('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8', '_blank', 'noopener,noreferrer')
  })

  it.each([
    ['a short tap', (el: Element) => fireEvent.pointerUp(el)],
    ['a scroll', (el: Element) => fireEvent.pointerMove(el, { clientX: 10, clientY: 40 })],
    ['leaving the cover', (el: Element) => fireEvent.pointerLeave(el)],
    ['a cancelled pointer', (el: Element) => fireEvent.pointerCancel(el)]
  ])('%s opens nothing', (_, end) => {
    const { el, open } = view()
    down(el)
    end(el)
    act(() => void vi.advanceTimersByTime(HOLD_MS * 2))
    expect(open).not.toHaveBeenCalled()
  })

  it('a finger that wobbles a little still counts as holding', () => {
    const { el, open } = view()
    down(el)
    fireEvent.pointerMove(el, { clientX: 14, clientY: 13 })
    act(() => void vi.advanceTimersByTime(HOLD_MS))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('holds back the browser menu (save image) on the cover', () => {
    const { el } = view()
    expect(fireEvent.contextMenu(el)).toBe(false)
  })
})

describe('where it is wired', () => {
  const src = (f: string) => readFileSync(join(process.cwd(), 'src/components/game', f), 'utf8')
  it('every album cover in a round (board cards, result dock, song info, turntable sleeves)', () => {
    expect(src('TimelineBoard.tsx')).toMatch(/<SpotifyHold song=\{song\}>\s*<SongCover song=\{song\} size=\{40\} \/>/)
    expect(src('PlacementDock.tsx')).toMatch(/<SpotifyHold song=\{song\}>\s*<SongCover song=\{song\} size=\{52\} \/>/)
    expect(src('SongInfo.tsx').match(/<SpotifyHold song=\{song\}>/g)).toHaveLength(2)
    expect(src('Turntable.tsx').match(/<SleeveHold song=\{song\}>/g)).toHaveLength(2)
  })
})
