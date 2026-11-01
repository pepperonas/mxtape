/**
 * Spielen — the landing destination after sign-in. A round still running on
 * this device comes first (continue or discard), then the one big way into a
 * new round (the record half out of its sleeve), the last round and the
 * nearest achievement. Nothing else competes for attention.
 */
import { EditionBanner } from '@/edition/SpecialEdition'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Avatar } from '@/components/ui/Avatar'
import { friendsApi, type Invite } from '@/online/friendsApi'
import { PENDING_ROOM_KEY } from './JoinScreen'
import { useMe } from '@/auth/AuthContext'
import { useAchievements, useGame, useGameHistory, useUI } from '@/contexts'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { roomCodeOrNull } from '@/online/roomCode'
import { HomeFooter } from '@/components/HomeFooter'
import { Vinyl } from '@/components/ui/Vinyl'
import { Icon } from '@/components/ui/Icon'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { MODE_COPY } from '@/game/modeCopy'
import { spring } from '@/motion/springs'
import { ownPlayerName } from '@/game/owner'
import { formatDay } from '@/utils/format'
import { turnName } from '@/game/teams'
import { useMessages } from '@/i18n'
import { homeText } from '@/i18n/messages/home'
import { dailyText } from '@/i18n/messages/daily'
import { useDailyBoard } from './DailyScreen'
import { ACHIEVEMENT_DEFINITIONS, achievementIcon, type Achievement } from '@/types/achievements'

export function HomeScreen() {
  const me = useMe()
  const navigate = useAppNavigate()
  const { history } = useGameHistory()
  const { getPlayerAchievements } = useAchievements()
  const game = useGame()
  const { showModal } = useUI()
  const t = useMessages(homeText)
  // Online rounds live in their room, not on this device
  const running = !game.onlineRoom && game.isGameStarted && !game.finished && game.players.length > 0 && game.gameMode

  // Came back from the Google sign-in that started on a room link: into the room
  useEffect(() => {
    let code: string | null = null
    try {
      code = localStorage.getItem(PENDING_ROOM_KEY)
      if (code) localStorage.removeItem(PENDING_ROOM_KEY)
    } catch {
      /* private mode */
    }
    if (code) navigate(`/r/${code}`, { replace: true })
  }, [navigate])
  const firstName = ownPlayerName(me.name)
  const last = history[0]
  const stored = getPlayerAchievements(firstName)
  const next = nearestAchievement(
    stored.length ? stored : Object.values(ACHIEVEMENT_DEFINITIONS).map((d) => ({ ...d, unlocked: false, progress: d.target ? 0 : undefined }))
  )

  function discard() {
    showModal(
      t.discardTitle,
      <p className="text-body-lg">{t.discardBody}</p>,
      [{ text: t.keep }, { text: t.discard, variant: 'danger', onClick: () => game.resetGame() }]
    )
  }

  function newGame() {
    if (!running) return navigate('/new')
    showModal(
      t.newRoundTitle,
      <p className="text-body-lg">{t.newRoundBody}</p>,
      [
        { text: t.continue, onClick: () => navigate('/game') },
        // Says that discarding the running round was confirmed (Setup checks)
        { text: t.newRound, variant: 'primary', onClick: () => navigate('/new', { state: { newRound: true } }) }
      ]
    )
  }

  return (
    <div className="flex-1 flex flex-col pt-4 md:pt-10 space-y-6">
      <EditionBanner />
      <h1 className="text-headline-md text-md-on-surface">
        {running ? t.greetRunning(firstName) : last ? t.greetAgain(firstName) : t.greetFirst(firstName)}
      </h1>

      <Invites />

      {running && <RunningRound onContinue={() => navigate('/game')} onDiscard={discard} />}

      {/* The sleeve: a brand-coloured card with the record sliding out of it */}
      <button
        type="button"
        onClick={newGame}
        className="group relative block w-full text-left overflow-hidden rounded-m3-xxl m3-state-layer"
        style={{ background: 'rgb(var(--mx-brand))', color: 'rgb(var(--mx-on-brand))', viewTransitionName: 'new-game' }}
      >
        <div className="relative z-10 p-7 pr-[42%] min-h-[220px] flex flex-col justify-between">
          <span className="text-poster" style={{ fontSize: 'clamp(2.4rem, 9vw, 3.4rem)' }}>
            {t.sleeveTop}
            <br />
            {t.sleeveBottom}
          </span>
          <span className="mt-6 inline-flex items-center gap-2 text-label-lg opacity-90">
            {t.sleeveHint}
            <Icon name="chevron" size={20} />
          </span>
        </div>
        {/* Positioning lives on a plain wrapper: Motion owns the transform below */}
        <div className="absolute top-1/2 right-0 translate-x-[38%] -translate-y-1/2">
          <m.div initial={{ x: 60, rotate: -30 }} animate={{ x: 0, rotate: 0 }} transition={spring.spatialSlow}>
            <div className="transition-transform duration-m3-spatial ease-m3-spatial group-hover:-translate-x-4 group-active:-translate-x-6">
              <Vinyl size="clamp(250px, 30vw, 340px)" spinning />
            </div>
          </m.div>
        </div>
      </button>

      <div className="flex justify-center -mt-2">
        <button type="button" className="btn btn-text m3-state-layer" onClick={() => showModal(t.joinTitle, <JoinWithCode />)} data-join-code>
          <Icon name="link" size={20} />
          {t.joinWithCode}
        </button>
      </div>

      <DailyCard />

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="last-round" className="surface p-5">
          <h2 id="last-round" className="text-title-md mb-3">
            {t.lastRound}
          </h2>
          {last ? (
            <button
              type="button"
              onClick={() => navigate(`/history/${last.id}`)}
              className="w-full text-left flex items-center gap-4 -m-2 p-2 rounded-m3-lg m3-state-layer"
            >
              <span className="grid place-items-center w-12 h-12 rounded-m3-lg bg-md-tertiary-container text-md-on-tertiary-container">
                <Icon name={MODE_COPY[last.gameMode]?.icon ?? 'note'} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-title-md truncate">{t.wonBy(last.winner.name)}</span>
                <span className="block meta truncate">
                  {MODE_COPY[last.gameMode]?.name ?? t.roundFallback}, {formatDay(last.date)}
                </span>
              </span>
              <Icon name="chevron" className="text-md-on-surface-variant" />
            </button>
          ) : (
            <p className="meta">{t.lastRoundEmpty}</p>
          )}
        </section>

        <section aria-labelledby="next-goal" className="surface p-5">
          <h2 id="next-goal" className="text-title-md mb-3">
            {t.nextGoal}
          </h2>
          {next ? (
            <button
              type="button"
              onClick={() => navigate('/achievements')}
              className="w-full text-left flex items-center gap-4 -m-2 p-2 rounded-m3-lg m3-state-layer"
            >
              <ProgressRing value={next.progress ?? 0} max={next.target ?? 1} size={48}>
                <Icon name={achievementIcon(next.id)} size={22} className="text-md-tertiary" />
              </ProgressRing>
              <span className="min-w-0 flex-1">
                <span className="block text-title-md truncate">{next.name}</span>
                <span className="block meta">
                  {next.target ? t.progressOf(next.progress ?? 0, next.target) : next.description}
                </span>
              </span>
            </button>
          ) : (
            <p className="meta">{t.nextGoalEmpty}</p>
          )}
        </section>
      </div>

      {/* at the bottom edge when the page is shorter than the screen */}
      <HomeFooter className="!mt-auto" />
    </div>
  )
}

/** The round saved on this device: who is on turn, the standings, continue or discard. */
function RunningRound({ onContinue, onDiscard }: { onContinue: () => void; onDiscard: () => void }) {
  const { gameMode, players, currentPlayer, startedAt, goal } = useGame()
  const t = useMessages(homeText)
  if (!gameMode) return null
  const hardcore = gameMode === 'hardcore'
  const onTurn = players[currentPlayer]
  const standings = [...players]
    .sort((a, b) => (hardcore ? b.score - a.score : b.cards - a.cards))
    .map((p) => `${p.name} ${hardcore ? p.score : p.cards}`)
    .join(' · ')
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))

  return (
    <m.section
      aria-labelledby="running-h"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.spatialDefault}
      className="rounded-m3-xl bg-md-surface-container-high text-md-on-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Vinyl size={64} spinning />
        <div className="min-w-0">
          <h2 id="running-h" className="text-title-lg">
            {t.runningTitle}
          </h2>
          <p className="text-body-md text-md-on-surface-variant">
            {MODE_COPY[gameMode].name}
            {onTurn ? t.onTurn(turnName(onTurn)) : ''}
            {minutes < 600 ? t.since(minutes) : ''}
          </p>
          <p className="text-body-sm text-md-on-surface-variant tabular">
            {standings}
            {hardcore ? t.points : t.ofGoal(goal)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col">
        <button type="button" className="btn btn-brand m3-state-layer flex-1" onClick={onContinue}>
          <Icon name="play" />
          {t.continue}
        </button>
        <button type="button" className="btn btn-text m3-state-layer flex-1" onClick={onDiscard}>
          {t.discard}
        </button>
      </div>
    </m.section>
  )
}

/** Locked achievement with the highest completion ratio (progress-based first). */
function nearestAchievement(list: Achievement[]): Achievement | null {
  const locked = list.filter((a) => !a.unlocked)
  if (locked.length === 0) return null
  const withProgress = locked
    .filter((a) => a.target && (a.progress ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) / (b.target ?? 1) - (a.progress ?? 0) / (a.target ?? 1))
  return withProgress[0] ?? locked[0]
}

/** Invitations from friends into an open room: checked every 30 s and when the tab returns. */
function Invites() {
  const navigate = useAppNavigate()
  const t = useMessages(homeText)
  const [invites, setInvites] = useState<Invite[]>([])
  const load = useCallback(() => {
    friendsApi
      .invites()
      .then((r) => setInvites(r.invites))
      .catch(() => {})
  }, [])
  useEffect(() => {
    load()
    const id = window.setInterval(load, 30_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const dismiss = (inv: Invite) => {
    setInvites((list) => list.filter((i) => i.id !== inv.id))
    void friendsApi.dismissInvite(inv.id).catch(() => {})
  }

  return (
    <AnimatePresence initial={false}>
      {invites.map((inv) => (
        <m.section
          key={inv.id}
          layout
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, transition: spring.effectsDefault }}
          transition={spring.spatialDefault}
          className="surface p-4 flex flex-wrap items-center gap-x-4 gap-y-3"
          aria-label={t.inviteLabel}
        >
          <Avatar name={inv.from?.name ?? '?'} picture={inv.from?.picture || undefined} size={48} />
          <div className="flex-1 min-w-[12rem]">
            <p className="text-title-md">{t.invitesYou(inv.from?.firstName ?? t.someone)}</p>
            <p className="meta">{t.inviteBody}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button type="button" className="btn btn-brand m3-state-layer" onClick={() => navigate(`/r/${inv.code}`)}>
              {t.join}
            </button>
            <button type="button" className="btn btn-text m3-state-layer" onClick={() => dismiss(inv)}>
              {t.later}
            </button>
          </div>
        </m.section>
      ))}
    </AnimatePresence>
  )
}

/** Tagesrunde: open today, or today's result. */
function DailyCard() {
  const t = useMessages(dailyText)
  const navigate = useAppNavigate()
  const { board } = useDailyBoard()
  return (
    <button
      type="button"
      onClick={() => navigate('/daily')}
      className="w-full text-left surface p-5 flex items-center gap-4 m3-state-layer"
    >
      <span className="grid place-items-center w-12 h-12 rounded-m3-lg bg-md-secondary-container text-md-on-secondary-container">
        <Icon name="today" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title-md">{t.homeTitle}</span>
        <span className="block meta truncate">
          {!board?.mine
            ? t.homeOpen
            : board.mine.state === 'running'
              ? t.homeRunning(board.mine.score)
              : board.mine.total === 10
                ? t.homeDoneOld(board.mine.score, board.mine.total)
                : t.homeDone(board.mine.score)}
        </span>
      </span>
      <Icon name="chevron" className="text-md-on-surface-variant" />
    </button>
  )
}

/** Join a room by typing its code (a shared link is the other way in). */
export function JoinWithCode() {
  const t = useMessages(homeText)
  const navigate = useAppNavigate()
  const { closeModal } = useUI()
  const [raw, setRaw] = useState('')
  const [invalid, setInvalid] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = roomCodeOrNull(raw)
    if (!code) {
      setInvalid(true)
      return
    }
    await closeModal()
    navigate(`/r/${code}`)
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" data-join-form>
      <p className="text-body-lg">{t.joinText}</p>
      <div>
        <label htmlFor="join-code" className="sr-only">
          {t.joinLabel}
        </label>
        <input
          id="join-code"
          className="field text-center tracking-[0.2em] uppercase num-poster"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            setInvalid(false)
          }}
          placeholder="AB12-CD34"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={12}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'join-code-error' : undefined}
          autoFocus
        />
        {invalid && (
          <p id="join-code-error" className="mt-2 text-body-sm text-md-error" role="alert">
            {t.joinInvalid}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn btn-text m3-state-layer flex-1" onClick={() => void closeModal()}>
          {t.joinCancel}
        </button>
        <button type="submit" className="btn btn-brand m3-state-layer flex-1" disabled={raw.trim().length === 0}>
          {t.joinGo}
        </button>
      </div>
    </form>
  )
}
