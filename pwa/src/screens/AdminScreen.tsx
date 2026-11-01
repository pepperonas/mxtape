/**
 * Zugänge verwalten (admin only — the server answers 404 to everyone else).
 * Pending requests first. Every decision applies at once and can be undone
 * from the snackbar for a few seconds.
 */
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { api, type AccountStatus } from '@/api/client'
import { useMe } from '@/auth/AuthContext'
import { useUI } from '@/contexts'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { SubPageHeader } from '@/shell/AppShell'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { spring } from '@/motion/springs'
import { formatDay, formatTime } from '@/utils/format'
import { msg, useMessages } from '@/i18n'
import { adminText } from '@/i18n/messages/admin'
import { apiErrorText } from '@/i18n/messages/errors'
import { AdminWishes, useWishCount } from './AdminWishes'
import { AdminReports, useReportCount } from './AdminReports'
import { AdminStats } from './AdminStats'

interface Account {
  id: number
  email: string
  name: string
  picture: string
  status: AccountStatus
  isAdmin: boolean
  /** How the account signs in */
  method?: 'google' | 'password'
  createdAt: string | null
  decidedAt: string | null
  lastLoginAt: string | null
}

type Action = 'approve' | 'reject' | 'block' | 'unblock' | 'reset'
type Tab = 'pending' | 'approved' | 'closed' | 'reports' | 'wishes' | 'stats'

const TABS: { id: Tab; label: 'tabPending' | 'tabApproved' | 'tabClosed' | 'tabReports' | 'tabWishes' | 'tabStats' }[] = [
  { id: 'pending', label: 'tabPending' },
  { id: 'approved', label: 'tabApproved' },
  { id: 'closed', label: 'tabClosed' },
  { id: 'reports', label: 'tabReports' },
  { id: 'wishes', label: 'tabWishes' },
  { id: 'stats', label: 'tabStats' }
]

const inTab = (a: Account, tab: Exclude<Tab, 'reports' | 'wishes' | 'stats'>) => (tab === 'closed' ? a.status === 'rejected' || a.status === 'blocked' : a.status === tab)

/** The action that restores a previous status (for undo). */
const RESTORE: Record<AccountStatus, Action> = { pending: 'reset', approved: 'approve', rejected: 'reject', blocked: 'block' }

export function AdminScreen() {
  const me = useMe()
  const navigate = useAppNavigate()
  const { addToast } = useUI()
  const t = useMessages(adminText)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [error, setError] = useState<string | null>(null)
  const initialReports = useReportCount()
  const [reportCount, setReportCount] = useState<number | null>(null)
  const openReports = reportCount ?? initialReports
  const initialWishes = useWishCount()
  const [wishCount, setWishCount] = useState<number | null>(null)
  const openWishes = wishCount ?? initialWishes

  useEffect(() => {
    if (!me.isAdmin) navigate('/', { replace: true })
  }, [me.isAdmin, navigate])

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: Account[] }>('/api/admin/users')
      setAccounts(res.users)
      setError(null)
    } catch {
      setError('load')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decide = useCallback(
    async (account: Account, action: Action, undoable = true) => {
      const before = account.status
      try {
        const updated = await api<Account>(`/api/admin/users/${account.id}/${action}`, { method: 'POST' })
        setAccounts((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? null)
        const who = account.name || account.email
        addToast(
          msg(adminText).done(who, action),
          'success',
          5000,
          undoable ? { label: msg(adminText).undo, onClick: () => void decide(updated, RESTORE[before], false) } : undefined
        )
      } catch (e) {
        addToast(apiErrorText(e), 'error')
      }
    },
    [addToast]
  )

  const counts = {
    pending: accounts?.filter((a) => inTab(a, 'pending')).length ?? 0,
    approved: accounts?.filter((a) => inTab(a, 'approved')).length ?? 0,
    closed: accounts?.filter((a) => inTab(a, 'closed')).length ?? 0,
    reports: openReports,
    wishes: openWishes
  }
  const shown = tab === 'reports' || tab === 'wishes' || tab === 'stats' ? [] : (accounts?.filter((a) => inTab(a, tab)) ?? [])

  return (
    <div>
      <SubPageHeader title={t.title} back="/settings" inRail />

      <div role="tablist" aria-label={t.statusLabel} className="flex overflow-x-auto border-b border-md-outline-variant/60 -mx-4 sm:mx-0 px-2 sm:px-0">
        {TABS.map((tab_) => {
          const active = tab === tab_.id
          return (
            <button
              key={tab_.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tab_.id)}
              className={`relative flex-1 shrink-0 min-w-max whitespace-nowrap min-h-[48px] px-3 text-label-lg m3-state-layer ${active ? 'text-md-primary' : 'text-md-on-surface-variant'}`}
            >
              <span className="inline-flex items-center gap-2">
                {t[tab_.label]}
                {(tab_.id === 'pending' || tab_.id === 'reports' || tab_.id === 'wishes') && counts[tab_.id] > 0 && (
                  <span
                    className={`grid place-items-center min-w-6 h-6 px-1.5 rounded-full text-label-md tabular ${
                      'bg-md-error text-md-on-error'
                    }`}
                  >
                    {counts[tab_.id]}
                  </span>
                )}
              </span>
              {active && (
                <m.span layoutId="admin-tab" transition={spring.spatialFast} className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t-full bg-md-primary" />
              )}
            </button>
          )
        })}
      </div>

      {tab === 'stats' ? (
        <div className="pt-6" role="tabpanel">
          <AdminStats />
        </div>
      ) : tab === 'reports' ? (
        <div className="pt-4" role="tabpanel">
          <AdminReports onCount={setReportCount} />
        </div>
      ) : tab === 'wishes' ? (
        <div className="pt-4" role="tabpanel">
          <AdminWishes onCount={setWishCount} />
        </div>
      ) : (
      <div className="pt-4" role="tabpanel">
        {error && (
          <div className="surface p-6 text-center">
            <p className="text-body-lg">{t.loadFailed}</p>
            <button type="button" className="btn btn-tonal m3-state-layer mt-4" onClick={() => void load()}>
              {t.reload}
            </button>
          </div>
        )}
        {!accounts && !error && <div className="m3-loading mx-auto mt-10" aria-label={t.loading}><span className="m3-loading-arc" /></div>}

        {accounts && shown.length === 0 && <EmptyTab tab={tab} />}

        <ul className="space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((a) => (
              <m.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 60, scale: 0.96, transition: spring.effectsDefault }}
                transition={spring.spatialDefault}
                className="surface p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar name={a.name || a.email} picture={a.picture} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-title-md truncate">
                      {a.name || a.email}
                      {a.isAdmin && <span className="ml-2 text-label-md text-md-primary">{t.admin}</span>}
                    </p>
                    <p className="meta truncate">
                      {a.email}
                      <span className="ml-2 text-label-md">· {a.method === 'password' ? t.viaEmail : t.viaGoogle}</span>
                    </p>
                    <p className="text-label-md text-md-on-surface-variant mt-0.5">{describe(t, a)}</p>
                  </div>
                </div>

                {!a.isAdmin && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {a.status === 'pending' && (
                      <>
                        <button type="button" className="btn btn-text m3-state-layer" onClick={() => void decide(a, 'reject')}>
                          {t.reject}
                        </button>
                        <button type="button" className="btn btn-filled m3-state-layer" onClick={() => void decide(a, 'approve')}>
                          <Icon name="check" size={20} />
                          {t.approve}
                        </button>
                      </>
                    )}
                    {a.status === 'approved' && (
                      <button type="button" className="btn btn-text m3-state-layer text-md-error" onClick={() => void decide(a, 'block')}>
                        <Icon name="block" size={20} />
                        {t.block}
                      </button>
                    )}
                    {(a.status === 'rejected' || a.status === 'blocked') && (
                      <button type="button" className="btn btn-tonal m3-state-layer" onClick={() => void decide(a, 'approve')}>
                        <Icon name="check" size={20} />
                        {t.approveAnyway}
                      </button>
                    )}
                  </div>
                )}
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
      )}
    </div>
  )
}

function describe(t: (typeof adminText)['de'], a: Account): string {
  const at = (iso: string | null) => (iso ? `${formatDay(iso)}, ${formatTime(iso)}` : '')
  switch (a.status) {
    case 'pending':
      return t.requested(at(a.createdAt))
    case 'approved':
      return a.lastLoginAt ? t.lastSignIn(at(a.lastLoginAt)) : t.approved
    case 'rejected':
      return t.rejected(at(a.decidedAt))
    case 'blocked':
      return t.blocked(at(a.decidedAt))
  }
}

function EmptyTab({ tab }: { tab: Exclude<Tab, 'reports' | 'wishes' | 'stats'> }) {
  const t = useMessages(adminText)
  const copy = {
    pending: [t.emptyPendingTitle, t.emptyPendingText],
    approved: [t.emptyApprovedTitle, t.emptyApprovedText],
    closed: [t.emptyClosedTitle, t.emptyClosedText]
  }[tab]
  return (
    <div className="py-12 text-center">
      <Icon name={tab === 'pending' ? 'check' : 'person'} size={40} className="mx-auto text-md-on-surface-variant" />
      <p className="mt-4 text-title-md">{copy[0]}</p>
      <p className="mt-1 meta max-w-[32ch] mx-auto">{copy[1]}</p>
    </div>
  )
}
