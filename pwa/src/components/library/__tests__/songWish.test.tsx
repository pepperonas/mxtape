import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { UIProvider } from '@/contexts/UIContext'
import { Modal } from '@/components'
import { AuthProvider } from '@/auth/AuthContext'
import { WishForm, SongWishCorner, SongWishButton } from '../SongWish'
import { AdminWishes, addSongCommand } from '@/screens/AdminWishes'

afterEach(() => vi.unstubAllGlobals())

type Call = { url: string; method: string; body: unknown }

function serve(status: 'approved' | 'pending', wishes: unknown[] = [], admin: unknown[] = []) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s })
      if (url === '/api/session') return json({ me: { id: 1, email: 'a@example.com', name: 'Anna', picture: '', status, isAdmin: false, csrf: 't' } })
      if (url === '/api/songs/wishes/mine') return json({ wishes })
      if (url === '/api/admin/wishes') return json({ wishes: admin })
      return json({ ok: true }, 202)
    })
  )
  return calls
}

const tree = (children: React.ReactNode) => (
  <MotionTestProvider>
    <MemoryRouter>
      <AuthProvider>
        <UIProvider>
          {children}
          <Modal />
        </UIProvider>
      </AuthProvider>
    </MemoryRouter>
  </MotionTestProvider>
)

describe('song wishes', () => {
  it('the form sends artist, title and note; it waits for both fields', async () => {
    const calls = serve('approved')
    render(tree(<WishForm prefill={{ title: 'Waterlo' }} />))
    const send = screen.getByRole('button', { name: 'Wünschen' }) as HTMLButtonElement
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Waterlo')
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Interpret'), { target: { value: 'ABBA' } })
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Waterloo' } })
    fireEvent.change(screen.getByLabelText(/Anmerkung/), { target: { value: 'für die Party' } })
    fireEvent.click(send)
    await waitFor(() => expect(calls.some((c) => c.url === '/api/songs/wishes')).toBe(true))
    expect(calls.find((c) => c.url === '/api/songs/wishes')).toMatchObject({
      method: 'POST',
      body: { artist: 'ABBA', title: 'Waterloo', note: 'für die Party' }
    })
  })

  it('the corner shows the own wishes with what became of them', async () => {
    serve('approved', [
      { id: 2, artist: 'Nena', title: '99 Luftballons', at: '', status: 'added' },
      { id: 1, artist: 'ABBA', title: 'Waterloo', at: '', status: 'open' }
    ])
    render(tree(<SongWishCorner />))
    await screen.findByText('Deine Wünsche')
    expect(screen.getByText('Aufgenommen')).toBeTruthy()
    expect(screen.getByText('Offen')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Song wünschen' })).toBeTruthy()
  })

  it('nobody without an approved account sees the button', async () => {
    const calls = serve('pending')
    render(tree(<><SongWishButton /><SongWishCorner /></>))
    await waitFor(() => expect(calls.some((c) => c.url === '/api/session')).toBe(true))
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByRole('button', { name: 'Song wünschen' })).toBeNull()
    expect(calls.some((c) => c.url === '/api/songs/wishes/mine')).toBe(false)
  })
})

describe('song wishes in the admin area', () => {
  it('lists the wishes and takes a decision off the list', async () => {
    const calls = serve('approved', [], [
      { key: 'abba|waterloo', artist: 'ABBA', title: 'Waterloo', count: 2, by: ['Lisa', 'Tom'], notes: [{ by: 'Lisa', text: 'bitte' }], latest: '' }
    ])
    render(tree(<AdminWishes />))
    await screen.findByText('Waterloo')
    expect(screen.getByText('2 Wünsche')).toBeTruthy()
    expect(screen.getByText('Lisa, Tom')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aufgenommen' }))
    await waitFor(() => expect(screen.queryByText('Waterloo')).toBeNull())
    expect(calls.find((c) => c.url === '/api/admin/wishes/resolve')).toMatchObject({ method: 'POST', body: { key: 'abba|waterloo', outcome: 'added' } })
  })

  it('the copied command quotes for the shell', () => {
    expect(addSongCommand({ artist: "Guns N' Roses", title: 'Patience' })).toBe(
      "node scripts/song-management/add-song.js 'Guns N'\\'' Roses' 'Patience'"
    )
  })
})
