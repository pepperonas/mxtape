/**
 * Sign-in and sign-up with e-mail and password: one panel, three forms
 * (sign in, register, forgot password) and the "check your inbox" note.
 * After signing in, the gate takes over (waiting room or app).
 */
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { api, ApiError } from '@/api/client'
import { useAuth } from './AuthContext'
import { Icon } from '@/components/ui/Icon'
import { useLang, useMessages } from '@/i18n'
import { authText } from '@/i18n/messages/auth'
import { apiErrorText, errorsText } from '@/i18n/messages/errors'
import { spring } from '@/motion/springs'

export type EmailMode = 'signin' | 'register' | 'forgot'
type Sent = { kind: 'register' | 'forgot'; email: string }

const MIN_PASSWORD = 8

export function EmailAuth({ initialMode = 'signin', initialName = '' }: { initialMode?: EmailMode; initialName?: string }) {
  const t = useMessages(authText)
  const te = useMessages(errorsText)
  const { lang } = useLang()
  const { refresh } = useAuth()
  const [mode, setMode] = useState<EmailMode>(initialMode)
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [resent, setResent] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const errorId = useId()

  const switchTo = (next: EmailMode) => {
    setMode(next)
    setError(null)
    setUnverified(false)
  }

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'email_unverified') {
      setUnverified(true)
      setError(null)
    } else {
      setError(e instanceof ApiError ? apiErrorText(e, te.tryAgain) : te.noConnection)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setResent(false)
    try {
      if (mode === 'signin') {
        await api('/api/auth/password-login', { method: 'POST', json: { email, password } })
        const me = await refresh()
        // Leave the scrolled email form at the personal edition's opening card.
        if (me?.edition === 'martin') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        return
      }
      if (mode === 'register') {
        await api('/api/auth/register', { method: 'POST', json: { name, email, password, lang } })
        setSent({ kind: 'register', email: email.trim() })
      } else {
        await api('/api/auth/forgot', { method: 'POST', json: { email, lang } })
        setSent({ kind: 'forgot', email: email.trim() })
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    try {
      await api('/api/auth/resend', { method: 'POST', json: { email, password, lang } })
      setResent(true)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <Panel id="sent">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-md-secondary-container text-md-on-secondary-container">
            <Icon name="mail" size={20} />
          </span>
          <div className="space-y-2" role="status">
            <p className="text-title-md text-md-on-surface">{t.sentTitle}</p>
            <p className="text-body-md text-md-on-surface-variant">
              {sent.kind === 'register' ? t.sentRegister(sent.email) : t.sentForgot(sent.email)}
            </p>
            <p className="text-body-sm text-md-on-surface-variant">{t.sentSpam}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-text m3-state-layer w-full mt-2"
          onClick={() => {
            setSent(null)
            setPassword('')
            switchTo('signin')
          }}
        >
          {t.back}
        </button>
      </Panel>
    )
  }

  const valid =
    email.trim().length > 3 &&
    (mode === 'forgot' || password.length >= (mode === 'register' ? MIN_PASSWORD : 1)) &&
    (mode !== 'register' || name.trim().length > 0)

  return (
    <Panel id={mode === 'forgot' ? 'forgot' : 'form'}>
      {mode !== 'forgot' ? (
        <div role="radiogroup" aria-label={t.modeLabel} className="grid grid-cols-2 gap-1 p-1 rounded-full bg-md-surface-container-high">
          {(['signin', 'register'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mode === k}
              onClick={() => switchTo(k)}
              className={`relative min-h-[44px] rounded-full text-label-lg transition-colors ${
                mode === k ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant'
              }`}
            >
              {mode === k && (
                <m.span layoutId="email-mode-pill" className="absolute inset-0 rounded-full bg-md-secondary-container" transition={spring.spatialFast} />
              )}
              <span className="relative">{k === 'signin' ? t.modeSignIn : t.modeRegister}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-body-md text-md-on-surface-variant">{t.forgotIntro}</p>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate aria-describedby={error ? errorId : undefined}>
        {mode === 'register' && (
          <Field label={t.nameLabel} hint={t.nameHint}>
            {(id, hintId) => (
              <input
                id={id}
                className="field"
                value={name}
                maxLength={20}
                autoComplete="nickname"
                aria-describedby={hintId}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field label={t.emailLabel}>
          {(id) => (
            <input
              id={id}
              className="field"
              type="email"
              inputMode="email"
              value={email}
              maxLength={320}
              autoComplete={mode === 'register' ? 'email' : 'username'}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        {mode !== 'forgot' && (
          <Field label={t.passwordLabel} hint={mode === 'register' ? t.passwordHint : undefined}>
            {(id, hintId) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                describedBy={hintId}
              />
            )}
          </Field>
        )}

        {error && (
          <p id={errorId} role="alert" className="rounded-m3-lg bg-md-error-container text-md-on-error-container px-4 py-3 text-body-md">
            {error}
          </p>
        )}
        {unverified && (
          <div role="alert" className="rounded-m3-lg bg-md-tertiary-container text-md-on-tertiary-container px-4 py-3 space-y-2">
            <p className="text-body-md">{resent ? t.resent : t.unverified}</p>
            {!resent && (
              <button type="button" className="btn btn-text m3-state-layer -ml-3" disabled={busy} onClick={() => void resend()}>
                {t.resend}
              </button>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-lg btn-filled m3-state-layer w-full" disabled={busy || !valid} aria-busy={busy}>
          {busy ? t.sending : mode === 'signin' ? t.signInSubmit : mode === 'register' ? t.registerSubmit : t.forgotSubmit}
        </button>
      </form>

      {mode === 'signin' && (
        <button type="button" className="btn btn-text m3-state-layer w-full" onClick={() => switchTo('forgot')}>
          {t.forgot}
        </button>
      )}
      {mode === 'forgot' && (
        <button type="button" className="btn btn-text m3-state-layer w-full" onClick={() => switchTo('signin')}>
          {t.back}
        </button>
      )}
    </Panel>
  )
}

function Panel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={id}
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: spring.effectsFast }}
        transition={spring.spatialDefault}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, hintId?: string) => ReactNode }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-label-lg text-md-on-surface-variant">
        {label}
      </label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="text-body-sm text-md-on-surface-variant">
          {hint}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  describedBy?: string
}) {
  const t = useMessages(authText)
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        className="field pr-14"
        type={shown ? 'text' : 'password'}
        value={value}
        maxLength={200}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* Positioned by a wrapper: the button's own transform is its press scale */}
      <span className="absolute inset-y-0 right-1 flex items-center">
        <button
          type="button"
          className="icon-btn m3-state-layer"
          aria-label={shown ? t.hidePassword : t.showPassword}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          <Icon name={shown ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </span>
    </div>
  )
}
