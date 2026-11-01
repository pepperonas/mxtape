import type { Song } from '@/types'

/**
 * Where a song lives on Spotify. Only a link out: nothing is sent to Spotify
 * until someone opens it. Songs from the old catalogue still carry a real
 * track id (22 base62 characters); every other song opens Spotify's search
 * for artist and title.
 *
 * On phones the Spotify app opens itself: a web link from an installed PWA
 * lands in the browser, not in the app. Android gets an intent link that
 * names the app and carries the web page as its fallback (no app → the page
 * opens); iPhones get the spotify: scheme, and if the app does not take over
 * within a moment, the page. Desktops open the web page in a new tab.
 */
export const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/
export const SPOTIFY_PACKAGE = 'com.spotify.music'
/** How long an iPhone gets to switch to the app before the web page opens instead. */
export const APP_FALLBACK_MS = 1500

type SpotifySong = Pick<Song, 'title' | 'artist' | 'spotifyId'>

/** The path inside Spotify: track/<id> or search/<artist title>. */
function target(song: SpotifySong): { kind: 'track' | 'search'; value: string } {
  if (song.spotifyId && SPOTIFY_ID.test(song.spotifyId)) return { kind: 'track', value: song.spotifyId }
  return { kind: 'search', value: encodeURIComponent(`${song.artist} ${song.title}`) }
}

export function spotifyUrl(song: SpotifySong): string {
  const { kind, value } = target(song)
  return `https://open.spotify.com/${kind}/${value}`
}

/** spotify:track:<id> / spotify:search:<query> — opens the app on iPhones (and desktops with the app). */
export function spotifyAppUri(song: SpotifySong): string {
  const { kind, value } = target(song)
  return `spotify:${kind}:${value}`
}

/** Android: the app if installed, otherwise Chrome opens the web page itself. */
export function spotifyIntent(song: SpotifySong): string {
  const { kind, value } = target(song)
  return `intent://${kind}/${value}#Intent;scheme=spotify;package=${SPOTIFY_PACKAGE};S.browser_fallback_url=${encodeURIComponent(spotifyUrl(song))};end`
}

export type Platform = 'android' | 'ios' | 'other'

export function platformOf(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): Platform {
  if (/Android/i.test(nav.userAgent)) return 'android'
  // iPadOS reports itself as a Mac; touch gives it away
  if (/iPhone|iPad|iPod/i.test(nav.userAgent) || (/Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1)) return 'ios'
  return 'other'
}

/** Opens the song in the Spotify app where there is one, else on the web. */
export function openInSpotify(song: SpotifySong, platform: Platform = platformOf()): void {
  if (platform === 'android') {
    window.location.href = spotifyIntent(song)
    return
  }
  if (platform === 'ios') {
    // Leaving for the app hides the page; still visible a moment later = no app
    const fallback = window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.open(spotifyUrl(song), '_blank', 'noopener,noreferrer')
    }, APP_FALLBACK_MS)
    const left = () => {
      if (document.visibilityState === 'hidden') window.clearTimeout(fallback)
    }
    document.addEventListener('visibilitychange', left, { once: true })
    window.location.href = spotifyAppUri(song)
    return
  }
  window.open(spotifyUrl(song), '_blank', 'noopener,noreferrer')
}
