/**
 * Preview Player Service
 * Handles self-hosted audio playback using Howler.js
 * No authentication required - uses self-hosted MP3 files (128 kbps)
 */

import { Howl } from 'howler'
import type { Song } from '@/types'
import { msg } from '@/i18n'
import { modesText } from '@/i18n/messages/modes'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'

interface PreviewPlayerConfig {
  onStateChange?: (state: PlayerState) => void
  onProgress?: (progress: number) => void
  onEnd?: () => void
  onError?: (error: string) => void
  /** The browser blocked autoplay; playback starts on the next tap. */
  onBlocked?: () => void
}

/**
 * Songs list absolute URLs (https://mxtape.celox.io/audio/…). Playback always
 * goes to the same origin: /audio/ is behind the login (nginx auth_request),
 * so the session cookie must travel with the request.
 *
 * Since v0.5.1 the files are AAC (.m4a). A round saved before that still holds
 * .mp3 URLs, which no longer exist — they are mapped to the new file.
 */
export function audioSrc(previewUrl: string): string {
  let path = previewUrl
  try {
    path = new URL(previewUrl, window.location.origin).pathname
  } catch {
    /* keep as is */
  }
  return path.replace(/^(\/audio\/song_\d+)\.mp3$/, '$1.m4a')
}

export class PreviewPlayerService {
  private sound: Howl | null = null
  private currentSong: Song | null = null
  private state: PlayerState = 'idle'
  private config: PreviewPlayerConfig = {}
  private progressInterval: number | null = null
  /** A song loaded ahead (preload). */
  private next: { song: Song; start: number; sound: Howl } | null = null

  constructor(config: PreviewPlayerConfig = {}) {
    this.config = config
  }

  setConfig(config: PreviewPlayerConfig): void {
    this.config = config
  }

  /**
   * Play a song's preview (30 seconds)
   * @param song Song object with previewUrl
   * @param startTime Optional start time in seconds (default: 0)
   */
  async play(song: Song, startTime: number = 0): Promise<void> {
    // Check if preview URL exists
    if (!song.previewUrl) {
      this.setState('error')
      this.config.onError?.(msg(modesText).noAudioFile)
      throw new Error(`No preview URL for song: ${song.title}`)
    }

    // Stop current playback if any
    this.stop()

    this.setState('loading')
    this.currentSong = song

    // Loaded ahead (preload): take that sound over, it is buffered already
    const ahead = this.next && this.next.song.id === song.id ? this.next : null
    if (ahead) this.next = null
    const sound =
      ahead?.sound ??
      new Howl({
        src: [audioSrc(song.previewUrl)],
        html5: true, // Use HTML5 Audio for streaming
        volume: 0.8,
        preload: true
      })
    this.sound = sound
    this.wire(sound, song, startTime)
    if (ahead && sound.state() === 'loaded') {
      const at = sound.seek()
      if (typeof at !== 'number' || Math.abs(at - startTime) > 0.5) sound.seek(startTime)
      this.startProgressTracking()
    }

    // Start playback
    sound.play()
  }

  /**
   * Load a song ahead, silently, so it starts without a wait when it is
   * drawn: the file is requested and buffered at `startTime`. play() with the
   * same song takes it over. One song at a time; a new one replaces it.
   */
  preload(song: Song, startTime: number = 0): void {
    if (!song.previewUrl) return
    if (this.next?.song.id === song.id || this.currentSong?.id === song.id) return
    this.clearPreload()
    const sound = new Howl({ src: [audioSrc(song.previewUrl)], html5: true, volume: 0.8, preload: true })
    sound.once('load', () => {
      if (startTime > 0) sound.seek(startTime)
    })
    sound.once('loaderror', () => {
      if (this.next?.sound === sound) this.clearPreload()
    })
    this.next = { song, start: startTime, sound }
  }

  /** Where a preloaded song was buffered (null when it is not the one loaded ahead). */
  plannedStart(songId: string): number | null {
    return this.next?.song.id === songId ? this.next.start : null
  }

  /** The song loaded ahead, if any. */
  getPreloadedId(): string | null {
    return this.next?.song.id ?? null
  }

  /** Drop the song loaded ahead. */
  clearPreload(): void {
    this.next?.sound.unload()
    this.next = null
  }

  private wire(sound: Howl, song: Song, startTime: number): void {
    const mine = () => this.sound === sound
    sound.on('load', () => {
      if (!mine()) return
      // 'playing' is set by onplay — the browser may still block autoplay
      if (startTime > 0) sound.seek(startTime)
      this.startProgressTracking()
    })
    sound.on('play', () => {
      if (mine()) this.setState('playing')
    })
    sound.on('pause', () => {
      if (mine()) this.setState('paused')
    })
    sound.on('stop', () => {
      if (!mine()) return
      this.setState('stopped')
      this.stopProgressTracking()
    })
    sound.on('end', () => {
      if (!mine()) return
      this.setState('idle')
      this.stopProgressTracking()
      this.config.onEnd?.()
    })
    sound.on('loaderror', (_id, error) => {
      if (!mine()) return
      console.error(`Preview load error: ${song.title}`, error)
      this.setState('error')
      this.config.onError?.(msg(modesText).loadFailed)
    })
    sound.on('playerror', () => {
      if (!mine()) return
      // Autoplay blocked (typical after a reload on phones): wait paused and
      // start on the browser's next unlock (the first tap anywhere).
      this.setState('paused')
      this.config.onBlocked?.()
      sound.once('unlock', () => {
        if (mine() && this.state === 'paused') sound.play()
      })
    })
  }

  /** The song loaded right now (null when stopped). */
  getSongId(): string | null {
    return this.currentSong?.id ?? null
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.sound && this.state === 'playing') {
      this.sound.pause()
      this.stopProgressTracking()
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.sound && (this.state === 'paused' || this.state === 'error')) {
      this.sound.play()
      this.startProgressTracking()
    }
  }

  /**
   * Stop playback and cleanup
   */
  stop(): void {
    if (this.sound) {
      this.sound.stop()
      this.sound.unload()
      this.sound = null
    }
    this.stopProgressTracking()
    this.currentSong = null
    this.setState('idle')
  }

  /**
   * Seek to position (in seconds)
   * @param position Time in seconds (0-30)
   */
  seek(position: number): void {
    if (this.sound) {
      const duration = this.getDuration()
      const clampedPosition = Math.max(0, Math.min(position, duration))
      this.sound.seek(clampedPosition)
    }
  }

  /**
   * Get current playback position (in seconds)
   */
  getCurrentTime(): number {
    if (!this.sound) return 0
    const pos = this.sound.seek()
    return typeof pos === 'number' ? pos : 0
  }

  /**
   * Get total duration (full song length, typically 3-5 minutes)
   */
  getDuration(): number {
    if (this.sound) {
      return this.sound.duration()
    }
    return 30 // Default preview length
  }

  /**
   * Get current state
   */
  getState(): PlayerState {
    return this.state
  }

  /**
   * Get currently playing song
   */
  getCurrentSong(): Song | null {
    return this.currentSong
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.state === 'playing'
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    if (this.sound) {
      this.sound.volume(clampedVolume)
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    if (this.sound) {
      return this.sound.volume()
    }
    return 0.8 // Default
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop()
    this.clearPreload()
    this.config = {}
  }

  // Private methods

  private setState(state: PlayerState): void {
    this.state = state
    this.config.onStateChange?.(state)
  }

  private startProgressTracking(): void {
    // Clear existing interval
    this.stopProgressTracking()

    // Update progress every 100ms
    this.progressInterval = window.setInterval(() => {
      if (this.sound && this.state === 'playing') {
        const currentTime = this.getCurrentTime()
        const duration = this.getDuration()
        const progress = duration > 0 ? (currentTime / duration) * 100 : 0

        this.config.onProgress?.(progress)
      }
    }, 100)
  }

  private stopProgressTracking(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }
}

// Singleton instance (optional)
let previewPlayerInstance: PreviewPlayerService | null = null

export function getPreviewPlayer(): PreviewPlayerService {
  if (!previewPlayerInstance) {
    previewPlayerInstance = new PreviewPlayerService()
  }
  return previewPlayerInstance
}
