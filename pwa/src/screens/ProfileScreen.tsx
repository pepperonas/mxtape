/**
 * Profil — account, appearance, game options, saved players, data, admin.
 */
import { EditionDedication } from '@/edition/SpecialEdition'
import { clearSavedGame } from '@/game/savedGame'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth, useMe } from '@/auth/AuthContext'
import { useAchievements, useGameHistory, useSettings, useUI } from '@/contexts'
import { applyAppearance } from '@/contexts/SettingsContext'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { revealChange, toggleThemeWithReveal } from '@/utils/themeReveal'
import { ColorPicker } from '@/components/ui/ColorPicker'
import type { ColorScheme } from '@/styles/colorSchemes'
import { canVibrate } from '@/utils/haptics'
import { api } from '@/api/client'
import { LegalLinks } from '@/legal/LegalScreen'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useMessages } from '@/i18n'
import { profileText } from '@/i18n/messages/profile'

export const VERSION = '0.29.0'

export function ProfileScreen() {
  const me = useMe()
  const { logout } = useAuth()
  const navigate = useAppNavigate()
  const { settings, updateSettings } = useSettings()
  const { exportAll } = useGameHistory()
  const { exportAchievements } = useAchievements()
  const { showModal, addToast } = useUI()
  const themeBtn = useRef<HTMLSpanElement>(null)
  const pending = usePendingCount(me.isAdmin)
  const t = useMessages(profileText)

  const dark = settings.theme === 'dark'
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark'
    toggleThemeWithReveal(next, () => updateSettings({ theme: next }), themeBtn.current)
  }

  const chooseColor = (next: ColorScheme, origin: HTMLElement) =>
    revealChange(() => {
      // DOM first (the reveal snapshots right after), state and storage follow
      applyAppearance(settings.theme, next)
      updateSettings({ color: next })
    }, origin)

  const download = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), account: me.email, settings, history: JSON.parse(exportAll()), achievements: JSON.parse(exportAchievements()) }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mxtape-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const askWipe = () =>
    showModal(
      t.wipeTitle,
      <p className="text-body-lg">{t.wipeBody}</p>,
      [
        { text: t.cancel },
        {
          text: t.wipeConfirm,
          variant: 'danger',
          onClick: async () => {
            try {
              await api('/api/data', { method: 'DELETE' })
              window.location.reload()
            } catch {
              addToast(t.wipeFailed, 'error')
            }
          }
        }
      ]
    )

  const askDeleteAccount = () =>
    showModal(t.deleteAccountTitle, <p className="text-body-lg">{t.deleteAccountBody}</p>, [
      { text: t.cancel },
      {
        text: t.deleteAccountConfirm,
        variant: 'danger',
        onClick: async () => {
          try {
            await api('/api/me', { method: 'DELETE' })
            clearSavedGame()
            window.location.replace('/')
          } catch {
            addToast(t.deleteAccountFailed, 'error')
          }
        }
      }
    ])

  return (
    <div className="pt-4 md:pt-10 space-y-6 stagger-children">
      <h1 className="text-headline-md">{t.settingsTitle}</h1>
      <EditionDedication />

      <Group title={t.account}>
        <div className="flex items-center gap-4 px-4 py-4">
          <Avatar name={me.name} picture={me.picture} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-title-md truncate">{me.name || t.yourAccount}</p>
            <p className="meta truncate">{me.email}</p>
          </div>
          <button type="button" className="btn btn-tonal m3-state-layer shrink-0" onClick={() => void logout()}>
            <Icon name="logout" size={20} />
            <span className="hidden min-[400px]:inline">{t.signOut}</span>
          </button>
        </div>
        {me.isAdmin && (
          <button type="button" className="w-full flex items-center gap-4 px-4 py-3 min-h-[64px] text-left m3-state-layer" onClick={() => navigate('/admin')} data-admin-row>
            <Icon name="shield" className="text-md-primary" />
            <span className="flex-1 min-w-0">
              <span className="block text-body-lg">{t.manageAccess}</span>
              <span className="block meta">{pending === null ? t.loading : t.pending(pending)}</span>
            </span>
            {!!pending && (
              <span className="grid place-items-center min-w-7 h-7 px-2 rounded-full bg-md-error text-md-on-error text-label-lg tabular">{pending}</span>
            )}
            <Icon name="chevron" className="text-md-on-surface-variant" />
          </button>
        )}
      </Group>

      <Group title={t.appearance}>
        <Item icon={dark ? 'moon' : 'sun'} title={t.darkTheme} text={dark ? t.on : t.off}>
          <span ref={themeBtn}>
            <Switch checked={dark} onChange={toggleTheme} ariaLabel={t.darkTheme} />
          </span>
        </Item>
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-4">
            <Icon name="palette" className="text-md-on-surface-variant shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-body-lg">{t.color}</p>
              <p className="meta">
                {t[`color_${settings.color}`]} · {t.colorText}
              </p>
            </div>
          </div>
          <div className="sm:pl-10">
            <ColorPicker value={settings.color} onChange={chooseColor} />
          </div>
        </div>
        <Item icon="globe" title={t.language} text={t.languageText}>
          <LanguageSwitch />
        </Item>
      </Group>

      <Group title={t.game}>
        <Item icon="dice" title={t.randomStart} text={t.randomStartText}>
          <Switch checked={settings.randomStartPosition} onChange={(v) => updateSettings({ randomStartPosition: v })} ariaLabel={t.randomStart} />
        </Item>
        <Item icon="eye" title={t.hideYears} text={t.hideYearsText}>
          <Switch checked={settings.hideYearsInTimeline} onChange={(v) => updateSettings({ hideYearsInTimeline: v })} ariaLabel={t.hideYears} />
        </Item>
        {canVibrate() && (
          <Item icon="vibration" title={t.vibration} text={t.vibrationText}>
            <Switch checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} ariaLabel={t.vibration} />
          </Item>
        )}
      </Group>

      <Group title={t.notifications}>
        <Item icon="mail" title={t.dailyMail} text={t.dailyMailText}>
          <DailyMailSwitch label={t.dailyMail} failed={t.saveFailed} />
        </Item>
      </Group>

      <Group title={t.data}>
        <ActionRow icon="download" title={t.download} text={t.downloadText} onClick={download} />
        <ActionRow icon="delete" title={t.wipe} text={t.wipeText} onClick={askWipe} danger />
        <ActionRow icon="logout" title={t.deleteAccount} text={t.deleteAccountText} onClick={askDeleteAccount} danger />
      </Group>

      <Group title={t.about}>
        <button type="button" className="w-full flex items-center gap-4 px-4 py-3 min-h-[72px] text-left m3-state-layer" onClick={() => navigate('/about')} data-help-row>
          <Icon name="lightbulb" className="text-md-on-surface-variant shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-body-lg">{t.help}</span>
            <span className="block meta">{t.helpText}</span>
          </span>
          <Icon name="chevron" className="text-md-on-surface-variant" />
        </button>
        <div className="px-4 py-3 flex items-center gap-4">
          <Icon name="info" className="text-md-on-surface-variant shrink-0" />
          <span className="flex-1 text-body-lg">{t.version}</span>
          <span className="meta tabular">{VERSION}</span>
        </div>
        <div className="px-4 pb-2">
          <LegalLinks className="!justify-start" />
        </div>
      </Group>
    </div>
  )
}

function usePendingCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    api<{ counts: Record<string, number> }>('/api/admin/users?status=pending')
      .then((r) => setCount(r.counts.pending ?? 0))
      .catch(() => setCount(0))
  }, [enabled])
  return count
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-title-sm text-md-primary px-1 mb-2">{title}</h2>
      <div className="surface overflow-hidden divide-y divide-md-outline-variant/40">{children}</div>
    </section>
  )
}

function Item({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 min-h-[72px]">
      <Icon name={icon} className="text-md-on-surface-variant shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-body-lg">{title}</p>
        <p className="meta">{text}</p>
      </div>
      {children}
    </div>
  )
}

function ActionRow({ icon, title, text, onClick, danger }: { icon: IconName; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left flex items-center gap-4 px-4 py-3 min-h-[72px] m3-state-layer ${danger ? 'text-md-error' : ''}`}>
      <Icon name={icon} className={danger ? '' : 'text-md-on-surface-variant'} />
      <span className="flex-1 min-w-0">
        <span className="block text-body-lg">{title}</span>
        <span className={`block text-body-md ${danger ? 'opacity-80' : 'text-md-on-surface-variant'}`}>{text}</span>
      </span>
    </button>
  )
}

/** Mails from friends about their daily round: kept on the account (server), on by default. */
function DailyMailSwitch({ label, failed }: { label: string; failed: string }) {
  const me = useMe()
  const { refresh } = useAuth()
  const { addToast } = useUI()
  const [on, setOn] = useState(me.dailyMail !== false)
  const change = async (v: boolean) => {
    setOn(v)
    try {
      await api('/api/me/prefs', { method: 'PUT', json: { dailyMail: v } })
      void refresh()
    } catch {
      setOn(!v)
      addToast(failed, 'warning')
    }
  }
  return <Switch checked={on} onChange={(v) => void change(v)} ariaLabel={label} />
}
