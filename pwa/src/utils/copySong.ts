/**
 * Copy a song as "Artist – Title" to the clipboard (double tap on a face-up
 * timeline card, the copy button in the song library). Shows a toast either
 * way and gives a light tick on phones when it worked.
 */
import type { Song } from '@/types'
import { haptic } from './haptics'

export function songLine(song: Pick<Song, 'artist' | 'title'>): string {
  return `${song.artist} – ${song.title}`
}

export async function copySong(
  song: Pick<Song, 'artist' | 'title'>,
  toast: (message: string, type?: 'success' | 'warning') => void,
  text: { copied: (line: string) => string; copyFailed: string }
): Promise<boolean> {
  const line = songLine(song)
  try {
    await navigator.clipboard.writeText(line)
    haptic('tick')
    toast(text.copied(line), 'success')
    return true
  } catch {
    toast(text.copyFailed, 'warning')
    return false
  }
}

/** Copy any text; true when it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    haptic('tick')
    return true
  } catch {
    return false
  }
}
