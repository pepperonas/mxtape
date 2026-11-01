import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotion } from '@/test/motion'
import { SpecialEdition, EditionBanner, EditionDedication } from '../SpecialEdition'

const fixture = vi.hoisted(() => ({
  auth: { state: { kind: 'signed-in', me: { id: 42, edition: 'martin', status: 'approved', csrf: 'first-session' } } },
  game: { reveal: null as null | { playerIndex: number; song: { id: string } }, startedAt: 1, turnLog: [] as number[] }
}))
vi.mock('@/auth/AuthContext', () => ({ useAuthMaybe: () => fixture.auth }))
vi.mock('@/contexts/GameContext', () => ({ useGame: () => fixture.game }))

function view(path = '/') {
  return <StrictMode><MemoryRouter initialEntries={[path]}><SpecialEdition /><EditionBanner /></MemoryRouter></StrictMode>
}
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  sessionStorage.clear()
  fixture.auth.state = { kind: 'signed-in', me: { id: 42, edition: 'martin', status: 'approved', csrf: 'first-session' } }
  fixture.game.reveal = null
  fixture.game.turnLog = []
  setReducedMotion(false)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setReducedMotion(false) })

describe('personal edition', () => {
  it('is exclusive to the approved account and removes its appearance on account change', () => {
    const r = render(view())
    expect(screen.getByRole('region', { name: 'Martins Special Edition' })).toBeInTheDocument()
    expect(document.documentElement.dataset.edition).toBe('martin')
    fixture.auth.state.me.edition = ''
    r.rerender(view())
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.documentElement.dataset.edition).toBeUndefined()
    fixture.auth.state.me.edition = 'martin'
    fixture.auth.state.me.status = 'pending'
    r.rerender(view())
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('uses the reference sketch in the opening card without a popup, including after a fresh login', () => {
    const r = render(view())
    const card = screen.getByRole('region', { name: 'Martins Special Edition' })
    expect(card.querySelector('image')?.getAttribute('href')).toContain('porsche-911-sketch.png')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    r.unmount()
    const next = render(view())
    fixture.auth.state.me.csrf = 'new-session'
    next.rerender(view())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('region', { name: 'Martins Special Edition' })).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
    next.unmount()
    expect(document.documentElement.dataset.edition).toBeUndefined()
  })

  it('cleans up immediately during the signed-out exit animation', () => {
    const r = render(view())
    fixture.auth.state.kind = 'anonymous'
    r.rerender(view())
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('.edition-backdrop')).toBeNull()
    expect(document.documentElement.dataset.edition).toBeUndefined()
  })

  it('rotates quiet details at most once per minute, for four seconds', () => {
    render(view())
    advance(59_999)
    expect(screen.queryByText('Annette')).toBeNull()
    advance(1)
    expect(screen.getByText('Annette')).toBeInTheDocument()
    advance(4000)
    expect(screen.queryByText('Annette')).toBeNull()
    advance(56_000)
    expect(screen.getByText('Porsche')).toBeInTheDocument()
  })

  it('skips inactive tabs and focused inputs without queuing a surprise', () => {
    render(<>{view()}<input aria-label="Name" /></>)
    fireEvent.focusIn(screen.getByRole('textbox'))
    act(() => screen.getByRole('textbox').focus())
    advance(60_000)
    expect(screen.queryByText('Annette')).toBeNull()
    act(() => screen.getByRole('textbox').blur())
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    advance(60_000)
    expect(screen.queryByText('Annette')).toBeNull()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.queryByText('Annette')).toBeNull()
    advance(60_000)
    expect(screen.getByText('Annette')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('Annette')).toBeNull()
    fireEvent.pointerUp(document.body)
  })

  it('shows a detail only on every third reveal and removes it before guessing resumes', () => {
    const r = render(view('/game'))
    advance(180_000)
    expect(screen.queryByText('Annette')).toBeNull()
    for (let n = 1; n <= 3; n++) {
      fixture.game.reveal = { playerIndex: 0, song: { id: `song_${n}` } }
      fixture.game.turnLog = Array(n).fill(0)
      r.rerender(view('/game'))
      if (n < 3) expect(screen.queryByText('Annette')).toBeNull()
    }
    expect(screen.getByText('Annette')).toBeInTheDocument()
    fixture.game.reveal = null
    r.rerender(view('/game'))
    expect(screen.queryByText('Annette')).toBeNull()
  })

  it('skips dialogs and hides a running detail as soon as a dialog opens', async () => {
    const r = render(<>{view()}<div role="dialog">Settings</div></>)
    advance(60_000)
    expect(screen.queryByText('Annette')).toBeNull()
    r.rerender(view())
    advance(60_000)
    expect(screen.getByText('Annette')).toBeInTheDocument()
    await act(async () => { r.rerender(<>{view()}<div role="dialog">Settings</div></>) })
    expect(screen.queryByText('Annette')).toBeNull()
  })

  it('presents the dedication again on each settings visit, exclusively for Martin', () => {
    const settings = () => <MemoryRouter initialEntries={['/settings']}><SpecialEdition /><EditionDedication /></MemoryRouter>
    const first = render(settings())
    const banner = screen.getByRole('region', { name: 'Von Martin für Martin' })
    expect(banner).toHaveTextContent('Für die nächste gemeinsame Runde.')
    expect(banner.querySelector('.edition-car-draw')).not.toBeNull()
    first.unmount()
    const next = render(settings())
    expect(screen.getByRole('region', { name: 'Von Martin für Martin' })).not.toBe(banner)
    fixture.auth.state.me.edition = ''
    next.rerender(settings())
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('keeps the dedication static under reduced motion', () => {
    setReducedMotion(true)
    render(<MemoryRouter initialEntries={['/settings']}><SpecialEdition /><EditionDedication /></MemoryRouter>)
    const banner = screen.getByRole('region', { name: 'Von Martin für Martin' })
    expect(banner).toBeInTheDocument()
    expect(banner.querySelector('.edition-car-draw')).toBeNull()
  })

  it('keeps the banner but disables animated surprises under reduced motion', () => {
    setReducedMotion(true)
    render(view())
    expect(screen.getByRole('region')).toBeInTheDocument()
    expect(document.querySelector('.edition-car-draw')).toBeNull()
    advance(180_000)
    expect(screen.queryByText('Annette')).toBeNull()
  })
})
