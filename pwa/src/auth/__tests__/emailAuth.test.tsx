import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MotionTestProvider } from '@/test/MotionTestProvider'
import { AuthProvider } from '../AuthContext'
import { AuthGate } from '../AuthGate'
import { EmailAuth } from '../EmailAuth'
import { signUpPath } from '@/components/game/SignUpOffer'

type Handler = (body: Record<string, unknown>) => { status: number; body: unknown }

/** /api/session answers `me`; POSTs go to the handler for their path. */
function serve(routes: Record<string, Handler>, me: unknown = null) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  let session = me
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/session') return new Response(JSON.stringify({ me: session }), { status: 200 })
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
      calls.push({ url, body })
      const h = routes[url]
      if (!h) return new Response('{}', { status: 404 })
      const out = h(body)
      if (url === '/api/auth/password-login' && out.status === 200) session = out.body
      return new Response(JSON.stringify(out.body), { status: out.status })
    })
  )
  return calls
}

const renderAuth = (props: Parameters<typeof EmailAuth>[0] = {}) =>
  render(
    <MemoryRouter>
      <MotionTestProvider>
        <AuthProvider>
          <EmailAuth {...props} />
        </AuthProvider>
      </MotionTestProvider>
    </MemoryRouter>
  )

const submitButton = () => {
  const all = screen.getAllByRole('button', { name: /^anmelden$/i })
  return all[all.length - 1]
}

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('EmailAuth', () => {
  it.each(['martin', null])('returns the gift account to its card after email sign-in (edition %s)', async (edition) => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    serve({ '/api/auth/password-login': () => ({ status: 200, body: {
      id: 42, email: 'gift@example.com', name: 'Martin', picture: '', status: 'approved', isAdmin: false, csrf: 'csrf', edition
    } }) })
    renderAuth()
    type(/e-mail-adresse/i, 'gift@example.com')
    type(/^passwort$/i, 'test-password')
    fireEvent.click(submitButton())
    await waitFor(() => expect(submitButton()).not.toBeDisabled())
    if (edition === 'martin') expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    else expect(scroll).not.toHaveBeenCalled()
  })

  it('registers with name, address and password, then says to check the inbox', async () => {
    const calls = serve({ '/api/auth/register': () => ({ status: 202, body: { ok: true } }) })
    renderAuth({ initialMode: 'register', initialName: 'Lisa' })
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe('Lisa')
    type(/e-mail-adresse/i, 'lisa@example.com')
    const submit = screen.getByRole('button', { name: /konto anlegen/i })
    type(/^passwort$/i, 'kurz')
    expect(submit).toHaveProperty('disabled', true) // under 8 characters
    type(/^passwort$/i, 'geheim123')
    fireEvent.click(submit)
    expect(await screen.findByText(/schau in dein postfach/i)).toBeTruthy()
    expect(screen.getByText(/lisa@example.com/)).toBeTruthy()
    expect(calls[0]).toEqual({
      url: '/api/auth/register',
      body: { name: 'Lisa', email: 'lisa@example.com', password: 'geheim123', lang: 'de' }
    })
  })

  it('offers to resend the link when the address is not confirmed yet', async () => {
    const calls = serve({
      '/api/auth/password-login': () => ({ status: 403, body: { code: 'email_unverified', message: 'x' } }),
      '/api/auth/resend': () => ({ status: 202, body: { ok: true } })
    })
    renderAuth()
    type(/e-mail-adresse/i, 'lisa@example.com')
    type(/^passwort$/i, 'geheim123')
    fireEvent.click(submitButton())
    fireEvent.click(await screen.findByRole('button', { name: /link nochmal schicken/i }))
    expect(await screen.findByText(/neuer link ist unterwegs/i)).toBeTruthy()
    expect(calls[calls.length - 1]).toEqual({ url: '/api/auth/resend', body: { email: 'lisa@example.com', password: 'geheim123', lang: 'de' } })
  })

  it('shows the server message on wrong credentials', async () => {
    serve({
      '/api/auth/password-login': () => ({ status: 401, body: { code: 'invalid_credentials', message: 'E-Mail-Adresse oder Passwort stimmen nicht.' } })
    })
    renderAuth()
    type(/e-mail-adresse/i, 'lisa@example.com')
    type(/^passwort$/i, 'falsch')
    fireEvent.click(submitButton())
    expect((await screen.findByRole('alert')).textContent).toMatch(/stimmen nicht/)
  })

  it('sends a reset link from "forgot password"', async () => {
    const calls = serve({ '/api/auth/forgot': () => ({ status: 202, body: { ok: true } }) })
    renderAuth()
    fireEvent.click(screen.getByRole('button', { name: /passwort vergessen/i }))
    const send = await screen.findByRole('button', { name: /link schicken/i })
    type(/e-mail-adresse/i, 'lisa@example.com')
    fireEvent.click(send)
    expect(await screen.findByText(/link zum zurücksetzen/i)).toBeTruthy()
    expect(calls[0].url).toBe('/api/auth/forgot')
  })

  it('shows and hides the password', () => {
    serve({})
    renderAuth()
    const field = screen.getByLabelText(/^passwort$/i) as HTMLInputElement
    expect(field.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: /passwort zeigen/i }))
    expect(field.type).toBe('text')
  })
})

describe('sign-in page and gate', () => {
  const gate = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <MotionTestProvider>
          <AuthProvider>
            <AuthGate>
              <p>DIE APP</p>
            </AuthGate>
          </AuthProvider>
        </MotionTestProvider>
      </MemoryRouter>
    )

  it('signs in with e-mail and lands in the waiting room', async () => {
    serve({
      '/api/auth/password-login': () => ({
        status: 200,
        body: { id: 2, email: 'lisa@example.com', name: 'Lisa', picture: '', status: 'pending', isAdmin: false, csrf: 'c' }
      })
    })
    gate('/')
    fireEvent.click(await screen.findByRole('button', { name: /mit e-mail anmelden/i }))
    type(/e-mail-adresse/i, 'lisa@example.com')
    type(/^passwort$/i, 'geheim123')
    fireEvent.click(submitButton())
    expect(await screen.findByText(/fast geschafft, lisa/i)).toBeTruthy()
  })

  it('opens the reset page from the mail link without a session', async () => {
    serve({})
    gate('/reset-password?token=abc')
    expect(await screen.findByText(/neues passwort setzen/i)).toBeTruthy()
    expect(screen.getByLabelText(/neues passwort/i)).toBeTruthy() // token read: the form, not the expiry notice
    expect(screen.queryByText('DIE APP')).toBeNull()
  })

  it('the offer after a round opens the sign-up with the guest name', () => {
    expect(signUpPath('Lisa')).toBe('/?register=1&name=Lisa')
    expect(signUpPath('  ')).toBe('/?register=1')
  })
})
