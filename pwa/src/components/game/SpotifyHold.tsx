/**
 * Wraps an album cover in the game: press and hold it to open the song in
 * Spotify. Only ever around covers of songs that lie face up.
 */
import type { ReactNode } from 'react'
import type { Song } from '@/types'
import { useLongPress } from '@/hooks/useLongPress'
import { openInSpotify } from '@/utils/spotify'
import { haptic } from '@/utils/haptics'
import { useMessages } from '@/i18n'
import { gameText } from '@/i18n/messages/game'

export function SpotifyHold({ song, children, className = '' }: { song: Song; children: ReactNode; className?: string }) {
  const t = useMessages(gameText)
  const hold = useLongPress(() => {
    haptic('grab')
    openInSpotify(song)
  })
  return (
    <span
      {...hold}
      className={`block select-none [-webkit-touch-callout:none] ${className}`}
      title={t.holdForSpotify}
      data-spotify-hold
    >
      {children}
    </span>
  )
}
