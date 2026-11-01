import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { AppProviders } from '@/contexts'
import { dominantColor, tameColor } from '@/utils/coverColor'
import type { Song } from '@/types'

vi.mock('@/services/PreviewPlayerService', () => {
  const player = {
    setConfig: () => {},
    play: () => Promise.resolve(),
    stop: () => {},
    pause: () => {},
    resume: () => {},
    seek: () => {},
    preload: () => {},
    plannedStart: () => null,
    clearPreload: () => {},
    getState: () => 'idle',
    getCurrentTime: () => 0,
    getDuration: () => 200,
    getSongId: () => null
  }
  return { getPreviewPlayer: () => player }
})
const { Turntable, SLEEVE_SCALE, SLEEVE_SHIFT, RECORD_SHIFT } = await import('@/components/game/Turntable')

const px = (...rgb: number[][]) => rgb.flatMap(([r, g, b]) => [r, g, b, 255])

describe('the colour of a cover', () => {
  it('a black cover with a red logo is red: colourful pixels weigh more, near-black and near-white not at all', () => {
    const data = px(...Array(40).fill([5, 5, 5]), ...Array(20).fill([250, 250, 250]), [200, 30, 30], [190, 40, 35])
    const [r, g, b] = dominantColor(data)!
    expect(r).toBeGreaterThan(150)
    expect(g).toBeLessThan(60)
    expect(b).toBeLessThan(60)
  })
  it('a cover of only black and white has no colour; transparent pixels are left out', () => {
    expect(dominantColor(px([0, 0, 0], [255, 255, 255]))).toBeNull()
    expect(dominantColor([200, 30, 30, 0])).toBeNull()
  })
  it('tames the colour: same hue, calm saturation, mid lightness', () => {
    const toHsl = ([r, g, b]: number[]) => {
      const [R, G, B] = [r / 255, g / 255, b / 255]
      const max = Math.max(R, G, B)
      const min = Math.min(R, G, B)
      const l = (max + min) / 2
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
      return { s, l }
    }
    for (const c of [[255, 0, 0], [10, 10, 80], [250, 250, 200], [0, 200, 120]] as [number, number, number][]) {
      const { s, l } = toHsl(tameColor(c))
      expect(s).toBeLessThanOrEqual(0.71)
      expect(l).toBeGreaterThanOrEqual(0.41)
      expect(l).toBeLessThanOrEqual(0.63)
    }
    const [r, , b] = tameColor([255, 0, 0])
    expect(r).toBeGreaterThan(b) // still red
  })
})

describe('the sleeve on reveal', () => {
  const song = { id: 'song_001', title: 'T', artist: 'A', year: 1990, previewUrl: '/audio/song_001.m4a' } as unknown as Song
  const view = (props: { revealYear?: number | null; revealCover?: string | null; compact?: boolean }) => (
    <MotionTestProvider>
      <AppProviders>
        <Turntable song={song} audioRole="silent" cue={null} clockOffset={() => 0} revealCorrect {...props} />
      </AppProviders>
    </MotionTestProvider>
  )

  it.each([false, true])('shows the cover as a sleeve once revealed (compact: %s), not before', (compact) => {
    const { container, rerender } = render(view({ revealYear: null, revealCover: '/audio/covers/song_001.jpg', compact }))
    expect(container.querySelector('[data-sleeve]')).toBeNull()
    rerender(view({ revealYear: 1990, revealCover: '/audio/covers/song_001.jpg', compact }))
    const sleeve = container.querySelector('[data-sleeve] img')!
    expect(sleeve.getAttribute('src')).toBe('/audio/covers/song_001.jpg')
  })

  it('a cover that fails to load leaves no empty sleeve behind', async () => {
    const { container } = render(view({ revealYear: 1990, revealCover: '/audio/covers/missing.jpg' }))
    fireEvent.error(container.querySelector('[data-sleeve] img')!)
    // it fades out
    await waitFor(() => expect(container.querySelector('[data-sleeve]')).toBeNull())
  })

  it('no cover, no sleeve', () => {
    const { container } = render(view({ revealYear: 1990, revealCover: null }))
    expect(container.querySelector('[data-sleeve]')).toBeNull()
  })

  it('the cover is in front: the record slides out behind it, the year sits on the sleeve, the label carries no second cover', () => {
    for (const compact of [false, true]) {
      const { container, unmount } = render(view({ revealYear: 1984, revealCover: '/audio/covers/song_001.jpg', compact }))
      const sleeve = container.querySelector('[data-sleeve]')!
      const disc = container.querySelector('svg.vinyl')!
      // later in the DOM = painted on top (same stacking context)
      expect(disc.compareDocumentPosition(sleeve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(container.querySelector('svg.vinyl image')).toBeNull()
      if (!compact) expect(sleeve.querySelector('[data-sleeve-year]')?.textContent).toBe('1984')
      unmount()
    }
  })

  it('without a cover the year stays on the label', () => {
    const { container } = render(view({ revealYear: 1984, revealCover: null }))
    expect(container.querySelector('[data-sleeve-year]')).toBeNull()
    expect(container.textContent).toContain('1984')
  })

  it('sleeve and record stay on a 320 px phone, and most of the cover is not covered', () => {
    // place = 88 % of the turntable, min(76vw, 320px); margin beside it = 12 % of the viewport
    const turntable = 0.76 * 320
    const place = 0.88 * turntable
    const margin = (320 - turntable) / 2
    const size = SLEEVE_SCALE * place
    const centre = turntable / 2
    const sleeveLeft = centre - (SLEEVE_SHIFT / 100) * place - size / 2
    const recordRight = centre + (RECORD_SHIFT / 100) * place + size / 2
    expect(-sleeveLeft).toBeLessThan(margin)
    expect(recordRight - turntable).toBeLessThan(margin)
    // the record peeks out by at least a fifth of the sleeve, the cover stays whole
    const peek = recordRight - (centre - (SLEEVE_SHIFT / 100) * place + size / 2)
    expect(peek).toBeGreaterThan(size / 5)
  })

  it('the play button stays round while playing', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/components/game/Turntable.tsx', 'utf8')
    expect(src).not.toMatch(/borderRadius:\s*playing/)
    expect(src).toMatch(/w-\[26%\] aspect-square rounded-full/)
  })
})
