import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, fireEvent, act } from '@testing-library/react'
import { SpotifyHold } from '../SpotifyHold'
import { HOLD_MS } from '@/hooks/useLongPress'
import { spotifyUrl, spotifyAppUri, spotifyIntent, platformOf, openInSpotify, APP_FALLBACK_MS } from '@/utils/spotify'
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

describe('the Spotify app opens on phones', () => {
  it('names the track or the search inside the app', () => {
    expect(spotifyAppUri(song)).toBe('spotify:track:4PTG3Z6ehGkBFwjybzWkR8')
    expect(spotifyAppUri({ title: 'Last Christmas', artist: 'Wham!' })).toBe('spotify:search:Wham!%20Last%20Christmas')
  })

  it('Android: an intent for the Spotify app with the web page as its fallback', () => {
    expect(spotifyIntent(song)).toBe(
      'intent://track/4PTG3Z6ehGkBFwjybzWkR8#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=' +
        encodeURIComponent('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8') +
        ';end'
    )
  })

  it('tells the platforms apart (an iPad reports itself as a Mac with touch)', () => {
    expect(platformOf({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B)', maxTouchPoints: 5 })).toBe('android')
    expect(platformOf({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })).toBe('ios')
    expect(platformOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe('ios')
    expect(platformOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe('other')
  })

  const withLocation = () => {
    const loc = { href: '' }
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc as unknown as Location)
    return loc
  }

  it('Android hands the intent to the system, no new tab', () => {
    const loc = withLocation()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openInSpotify(song, 'android')
    expect(loc.href).toBe(spotifyIntent(song))
    expect(open).not.toHaveBeenCalled()
  })

  it('iPhone: the app; the web page only when the app did not take over', () => {
    vi.useFakeTimers()
    const loc = withLocation()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openInSpotify(song, 'ios')
    expect(loc.href).toBe('spotify:track:4PTG3Z6ehGkBFwjybzWkR8')
    act(() => void vi.advanceTimersByTime(APP_FALLBACK_MS))
    expect(open).toHaveBeenCalledWith(spotifyUrl(song), '_blank', 'noopener,noreferrer')
  })

  it('iPhone with the app: the page went away, no web page on top', () => {
    vi.useFakeTimers()
    withLocation()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    openInSpotify(song, 'ios')
    state.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    act(() => void vi.advanceTimersByTime(APP_FALLBACK_MS * 2))
    expect(open).not.toHaveBeenCalled()
  })

  it('iPhone: back from the app within the moment, still no web page on top', () => {
    vi.useFakeTimers()
    withLocation()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    openInSpotify(song, 'ios')
    state.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    state.mockReturnValue('visible')
    act(() => void vi.advanceTimersByTime(APP_FALLBACK_MS * 2))
    expect(open).not.toHaveBeenCalled()
  })

  it('iPhone: the app took over even when no visibility event arrived', () => {
    vi.useFakeTimers()
    withLocation()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    openInSpotify(song, 'ios')
    state.mockReturnValue('hidden')
    act(() => void vi.advanceTimersByTime(APP_FALLBACK_MS * 2))
    expect(open).not.toHaveBeenCalled()
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
