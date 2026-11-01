import { msg } from '@/i18n'
import { errorsText } from '@/i18n/messages/errors'

/**
 * Thin client for the mxtape API (same origin, session cookie).
 * State-changing requests carry the CSRF token from /api/me.
 */

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'blocked'

export interface Me {
  id: number
  email: string
  name: string
  picture: string
  status: AccountStatus
  isAdmin: boolean
  /** Signs in with e-mail and password (possibly Google too) */
  hasPassword?: boolean
  /** Mails from friends about their daily round (profile switch). */
  dailyMail?: boolean
  /** Account-specific gift; selected by the server, never by a display name. */
  edition?: 'martin' | null
  csrf: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

let csrfToken = ''
export function setCsrfToken(token: string) {
  csrfToken = token
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const method = (rest.method ?? 'GET').toUpperCase()
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...headers
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body
  })
  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    // Not JSON (e.g. a proxy error page) — fall through with an empty body
    if (res.ok) throw new ApiError(res.status, 'bad_response', msg(errorsText).badResponse)
  }
  if (!res.ok) {
    // Session ended or access withdrawn while the app is open: let the gate re-check.
    if ((res.status === 401 || (res.status === 403 && body.code === 'not_approved')) && path !== '/api/session') {
      window.dispatchEvent(new Event(SESSION_LOST))
    }
    throw new ApiError(res.status, String(body.code ?? 'error'), String(body.message ?? res.statusText), body)
  }
  return body as T
}

export const LOGIN_URL = '/api/auth/login'
export const SESSION_LOST = 'mx:session-lost'

// Login error texts (?login_error=…) live in i18n/messages/errors.ts (loginErrorText)
