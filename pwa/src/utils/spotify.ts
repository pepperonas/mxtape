import type { Song } from '@/types'

/**
 * Where a song lives on Spotify. Only a link out: nothing is sent to Spotify
 * until someone opens it. Songs from the old catalogue still carry a real
 * track id (22 base62 characters); every other song opens Spotify's search
 * for artist and title.
 */
export const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/

export function spotifyUrl(song: Pick<Song, 'title' | 'artist' | 'spotifyId'>): string {
  if (song.spotifyId && SPOTIFY_ID.test(song.spotifyId)) return `https://open.spotify.com/track/${song.spotifyId}`
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.artist} ${song.title}`)}`
}

/** Opens the song in Spotify (the app takes the link over where it is installed). */
export function openInSpotify(song: Pick<Song, 'title' | 'artist' | 'spotifyId'>): void {
  window.open(spotifyUrl(song), '_blank', 'noopener,noreferrer')
}
