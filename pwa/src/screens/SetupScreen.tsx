/**
 * Neues Spiel — one screen, top to bottom in the order people decide:
 * mode, who plays (with bots when alone, or teams from four people), then the
 * round itself (length, decades, Einspruch). Options are remembered for the
 * next round on this device.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { useMe } from '@/auth/AuthContext'
import { useGame, useGameHistory, useSettings, useUI } from '@/contexts'
import { roomApi } from '@/online/roomApi'
import type { MusicMode } from '@/online/protocol'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { SubPageHeader } from '@/shell/AppShell'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MODE_COPY, MODE_ORDER, DIFFICULTY_LABEL } from '@/game/modeCopy'
import { ownPlayerName } from '@/game/owner'
import { createBotPlayers } from '@/services/botPlayer'
import { spring } from '@/motion/springs'
import { allSongs } from '@/data/catalogue'
import { missedSongs, NEMESIS_MIN } from '@/game/stats'
import { MAX_JOKERS } from '@/game/bonus'
import { nextTolerance, toleranceOf } from '@/game/tolerance'
import { COLLECTIONS, DECADES, GENRE_GROUPS, countByDecade, decadeLabel, songPool, type Collection } from '@/game/songPool'
import { GOAL_LABEL, GOAL_OPTIONS, goalWord } from '@/game/roundEnd'
import { STARTING_CHALLENGES } from '@/game/challenge'
import { MIN_TEAM_PEOPLE, TEAMS, maxTeams, splitIntoTeams } from '@/game/teams'
import type { RoundOptions } from '@/contexts/GameContext'
import type { GameMode, Player } from '@/types'
import { useMessages } from '@/i18n'
import { setupText } from '@/i18n/messages/setup'

type Difficulty = keyof typeof DIFFICULTY_LABEL
const MIN_PLAYERS = 2
const LAST_MODE_KEY = 'mxster_last_mode'
const LAST_OPTIONS_KEY = 'mxster_last_options'
const LAST_DEVICES_KEY = 'mxster_last_devices'
const LAST_MUSIC_KEY = 'mxster_last_music'

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}
const SONGS_BY_DECADE = countByDecade(allSongs())
const EXOTIC_COUNT = allSongs().filter((s) => s.exotic).length
const DECADES_WITH_SONGS = DECADES.filter((d) => (SONGS_BY_DECADE[d] ?? 0) > 0)

function readLastOptions(): Partial<RoundOptions> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_OPTIONS_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return null
    return {
      goal: (GOAL_OPTIONS as readonly number[]).includes(raw.goal) ? raw.goal : undefined,
      decades: Array.isArray(raw.decades) ? raw.decades.filter((d: unknown) => DECADES_WITH_SONGS.includes(d as never)) : undefined,
      challengesEnabled: typeof raw.challengesEnabled === 'boolean' ? raw.challengesEnabled : undefined,
      exotics: typeof raw.exotics === 'boolean' ? raw.exotics : undefined,
      genres: Array.isArray(raw.genres) ? raw.genres.filter((g: unknown) => GENRE_GROUPS.includes(g as never)) : undefined,
      collection: COLLECTIONS.includes(raw.collection) ? raw.collection : undefined,
      bonus: typeof raw.bonus === 'boolean' ? raw.bonus : undefined
    }
  } catch {
    return null
  }
}

const TEAM_DOT: Record<string, string> = {
  primary: 'bg-md-primary',
  tertiary: 'bg-md-tertiary',
  secondary: 'bg-md-secondary',
  success: 'bg-md-success'
}

export function SetupScreen() {
  const me = useMe()
  const navigate = useAppNavigate()
  const {
    gameMode,
    setGameMode,
    players,
    addPlayer,
    removePlayer,
    setPlayers,
    updatePlayer,
    startGame,
    resetGame,
    isGameStarted,
    goal,
    decades,
    challengesEnabled,
    exotics,
    genres,
    collection,
    bonus,
    setOptions,
    finished,
    onlineRoom
  } = useGame()
  const location = useLocation()
  const { history } = useGameHistory()
  const missed = useMemo(() => missedSongs(history ?? []), [history])
  const nemesisLocked = missed.length < NEMESIS_MIN
  const theme = { genres, collection, songIds: collection === 'nemesis' ? missed : null }
  const t = useMessages(setupText)
  const { settings, addPlayer: rememberPlayer } = useSettings()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [botCount, setBotCount] = useState(1)
  // One level per bot (the count picks how many of them play)
  const [levels, setLevels] = useState<Difficulty[]>(['medium', 'medium', 'medium'])
  const inputRef = useRef<HTMLInputElement>(null)

  const humans = players.filter((p) => !p.isBot)
  const bots = players.filter((p) => p.isBot)
  // Year handicap (game/tolerance): open when someone has one already
  const [handicapOn, setHandicapOn] = useState(() => players.some((p) => toleranceOf(p) > 0))
  const switchHandicap = (on: boolean) => {
    setHandicapOn(on)
    if (!on) players.forEach((p, i) => p.tolerance && updatePlayer(i, { tolerance: 0 }))
  }
  const botsOn = bots.length > 0
  const canUseBots = humans.length === 1

  // Fresh setup: own name first, last mode preselected. Once per visit —
  // StrictMode replays effects, and the player list must not double up.
  const prepared = useRef(false)
  // Saved options are back in the context from the next render on; only then
  // may changes be written, or the first render would store the defaults.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (prepared.current) return
    prepared.current = true
    // A round running on this device is only given up after asking (Home
    // does that); any other way here (empty history, a typed address) goes
    // back to Home, where it can be continued or discarded
    const running = !onlineRoom && isGameStarted && !finished && players.length > 0 && Boolean(gameMode)
    if (running && !(location.state as { newRound?: boolean } | null)?.newRound) {
      navigate('/', { replace: true })
      return
    }
    if (isGameStarted) resetGame()
    if (!gameMode) setGameMode((localStorage.getItem(LAST_MODE_KEY) as GameMode | null) ?? MODE_ORDER[0])
    const last = readLastOptions()
    if (last) setOptions(Object.fromEntries(Object.entries(last).filter(([, v]) => v !== undefined)))
    setHydrated(true)
    if (isGameStarted || players.length === 0 || players.some((p) => p.members)) {
      if (players.some((p) => p.members)) setPlayers([])
      addPlayer(ownPlayerName(me.name))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bots only make sense against exactly one human — drop them otherwise.
  useEffect(() => {
    if (!canUseBots && botsOn) removeBots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBots, botsOn])

  function removeBots() {
    // Remove from the end so indices stay valid
    for (let i = players.length - 1; i >= 0; i--) if (players[i].isBot) removePlayer(i)
  }

  function setBots(on: boolean, count = botCount, lv = levels) {
    removeBots()
    if (!on) return
    createBotPlayers(count, lv.slice(0, count), humans).forEach((bot) => addPlayer(bot.name, bot))
  }

  const nameTaken = (n: string) => players.some((p) => p.name.toLowerCase() === n.toLowerCase())

  function add(raw: string) {
    const n = raw.trim().slice(0, 20)
    if (!n) return
    if (nameTaken(n)) {
      setNameError(t.nameTaken(n))
      return
    }
    if (botsOn) removeBots()
    addPlayer(n)
    rememberPlayer(n)
    setName('')
    setNameError(null)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    add(name)
    inputRef.current?.focus()
  }

  const suggestions = settings.savedPlayers.filter((n) => !nameTaken(n)).slice(0, 8)

  // ── Teams ────────────────────────────────────────────────────────────────
  const humanNames = humans.map((p) => p.name)
  const canUseTeams = humanNames.length >= MIN_TEAM_PEOPLE && !botsOn
  const [teamsOn, setTeamsOn] = useState(false)
  const [teamCount, setTeamCount] = useState(2)
  const [teams, setTeams] = useState<string[][]>([])
  const teamsActive = teamsOn && canUseTeams
  const humanKey = humanNames.join('|')

  // Keep the split in step with the line-up: new people join the smallest
  // team, people who left drop out; a different team count reshuffles.
  useEffect(() => {
    if (!teamsActive) return
    setTeams((prev) => {
      const count = Math.min(teamCount, maxTeams(humanNames.length))
      if (prev.length !== count) return splitIntoTeams(humanNames, count)
      const kept = prev.map((t) => t.filter((n) => humanNames.includes(n)))
      for (const name of humanNames) {
        if (kept.some((t) => t.includes(name))) continue
        kept.reduce((a, b) => (b.length < a.length ? b : a)).push(name)
      }
      return kept
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsActive, teamCount, humanKey])

  const moveToNextTeam = (name: string) =>
    setTeams((prev) => {
      const from = prev.findIndex((t) => t.includes(name))
      const to = (from + 1) % prev.length
      return prev.map((t, i) => (i === from ? t.filter((n) => n !== name) : i === to ? [...t, name] : t))
    })

  const emptyTeam = teamsActive && teams.some((t) => t.length === 0)

  // ── Round ────────────────────────────────────────────────────────────────
  const poolSize = useMemo(
    () => songPool(allSongs(), decades, exotics, theme).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decades, exotics, genres.join(), collection, missed.length]
  )
  const byDecade = useMemo(() => countByDecade(allSongs(), exotics), [exotics])
  const timelineMode = gameMode !== 'hardcore'
  const seats = teamsActive ? teams.length : players.length
  // Rough songs a round needs: every seat plays until the goal, plus misses
  const songsNeeded = goal * Math.max(2, seats) * (timelineMode ? 2 : 1)

  const toggleGenre = (g: string) => {
    const next = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]
    setOptions({ genres: next.length === GENRE_GROUPS.length ? [] : next })
  }
  // The nemesis list is fixed when the round starts (it travels with a room)
  const roundOptions = () => ({
    goal,
    decades,
    challengesEnabled,
    exotics,
    genres,
    // A restored "nemesis" needs enough misses, otherwise all songs
    collection: nemesisLocked && collection === 'nemesis' ? ('all' as Collection) : collection,
    songIds: collection === 'nemesis' && !nemesisLocked ? missed : null,
    bonus
  })
  // Every change is stored at once, so a reload keeps the setup as it was
  useEffect(() => {
    if (!hydrated) return
    if (gameMode) writePref(LAST_MODE_KEY, gameMode)
    writePref(LAST_OPTIONS_KEY, JSON.stringify({ goal, decades, challengesEnabled, exotics, genres, collection, bonus }))
  }, [hydrated, gameMode, goal, decades, challengesEnabled, exotics, genres, collection, bonus])

  const toggleDecade = (decade: number) => {
    const next = decades.includes(decade) ? decades.filter((d) => d !== decade) : [...decades, decade].sort()
    // Every decade picked is the same as "all"
    setOptions({ decades: next.length === DECADES_WITH_SONGS.length ? [] : next })
  }

  // One device passed around, or everyone on their own (online room)
  const [devices, setDevicesState] = useState<'one' | 'own'>(() => (readPref(LAST_DEVICES_KEY) === 'own' ? 'own' : 'one'))
  const [music, setMusicState] = useState<MusicMode>(() => (readPref(LAST_MUSIC_KEY) === 'everyone' ? 'everyone' : 'room'))
  const setDevices = (v: 'one' | 'own') => {
    setDevicesState(v)
    writePref(LAST_DEVICES_KEY, v)
  }
  const setMusic = (v: MusicMode) => {
    setMusicState(v)
    writePref(LAST_MUSIC_KEY, v)
  }
  const [opening, setOpening] = useState(false)
  const { addToast } = useUI()

  const ready = devices === 'own' ? !!gameMode : !!gameMode && players.length >= MIN_PLAYERS && !emptyTeam

  const openRoom = async () => {
    if (!gameMode) return
    setOpening(true)
    try {
      const room = await roomApi.create(music, { mode: gameMode, ...roundOptions() })
      navigate(`/room/${room.code}`, { replace: true })
    } catch {
      addToast(t.roomFailed, 'error')
      setOpening(false)
    }
  }

  const start = () => {
    if (devices === 'own') return void openRoom()
    if (!ready || !gameMode) return
    const opts = roundOptions()
    setOptions({ collection: opts.collection, songIds: opts.songIds, daily: null })
    if (teamsActive) {
      setPlayers(
        teams.map<Player>((members, i) => {
          // A team's handicap: the mean of its members', rounded
          const own = members.map((n) => toleranceOf(players.find((p) => p.name === n)))
          const tolerance = own.length ? Math.round(own.reduce((a, b) => a + b, 0) / own.length) : 0
          return { name: TEAMS[i].name, members, memberTurn: 0, timeline: [], cards: 0, score: 0, ...(tolerance ? { tolerance } : {}) }
        })
      )
    }
    startGame()
    navigate('/game', { replace: true })
  }

  return (
    <div style={{ viewTransitionName: 'new-game' }}>
      <SubPageHeader title={t.title} />

      <div className="space-y-8 pt-2 pb-40">
        {/* Devices */}
        <section aria-labelledby="devices-h" className="space-y-3">
          <h2 id="devices-h" className="text-title-md">
            {t.devicesHeading}
          </h2>
          <SegmentedControl
            label={t.devicesLabel}
            value={devices}
            onChange={setDevices}
            segments={[
              { value: 'one', label: t.oneDevice },
              { value: 'own', label: t.ownDevices }
            ]}
          />
          <p className="meta">
            {devices === 'one'
              ? t.oneDeviceHint
              : t.ownDevicesHint}
          </p>
          {devices === 'own' && (
            <div className="space-y-2">
              <SegmentedControl
                label={t.musicLabel}
                value={music}
                onChange={setMusic}
                segments={[
                  { value: 'room', label: t.musicRoom },
                  { value: 'everyone', label: t.musicEveryone }
                ]}
              />
              <p className="meta">
                {music === 'room'
                  ? t.musicRoomHint
                  : t.musicEveryoneHint}
              </p>
            </div>
          )}
        </section>

        {/* Mode */}
        <section aria-labelledby="mode-h">
          <h2 id="mode-h" className="text-title-md mb-3">
            {t.modeHeading}
          </h2>
          <div role="radiogroup" aria-labelledby="mode-h" className="grid gap-3">
            {MODE_ORDER.map((mode) => {
              const copy = MODE_COPY[mode]
              const selected = gameMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGameMode(mode)}
                  className="relative text-left flex items-start gap-4 p-4 m3-state-layer"
                  style={{
                    borderRadius: selected ? 'var(--m3-shape-xl)' : 'var(--m3-shape-lg)',
                    transition: 'border-radius var(--m3-spatial-default)'
                  }}
                >
                  <span
                    className={`absolute inset-0 transition-colors duration-m3-effects ${
                      selected ? 'bg-md-secondary-container' : 'bg-md-surface-container-low'
                    }`}
                    style={{ borderRadius: 'inherit' }}
                    aria-hidden="true"
                  />
                  <span
                    className={`relative grid place-items-center w-12 h-12 shrink-0 rounded-m3-full transition-colors duration-m3-effects ${
                      selected ? 'bg-md-primary text-md-on-primary' : 'bg-md-surface-container-highest text-md-on-surface-variant'
                    }`}
                  >
                    <Icon name={copy.icon} />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className={`block text-title-md ${selected ? 'text-md-on-secondary-container' : ''}`}>{copy.name}</span>
                    <span className={`block text-body-md ${selected ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant'}`}>
                      {selected ? copy.how(goal) : copy.short}
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {selected && (
                      <m.span
                        className="relative text-md-on-secondary-container"
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, transition: spring.effectsFast }}
                        transition={spring.spatialFast}
                      >
                        <Icon name="check" />
                      </m.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
        </section>

        {devices === 'one' && (
          <>
        {/* Players */}
        <section aria-labelledby="players-h">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="players-h" className="text-title-md">
              {t.playersHeading}
            </h2>
            <span className="meta tabular">{t.playersCount(players.length)}</span>
          </div>

          <ul className="space-y-2" aria-live="polite">
            <AnimatePresence initial={false}>
              {players.map((p, i) => (
                <m.li
                  key={p.name}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, transition: spring.effectsDefault }}
                  transition={spring.spatialDefault}
                  className="flex items-center gap-3 pl-4 pr-1 min-h-[56px] rounded-m3-lg bg-md-surface-container-low"
                >
                  <span
                    className={`grid place-items-center w-9 h-9 rounded-full text-label-lg ${
                      p.isBot ? 'bg-md-surface-container-highest text-md-on-surface-variant' : 'bg-md-tertiary-container text-md-on-tertiary-container'
                    }`}
                    aria-hidden="true"
                  >
                    {p.isBot ? <Icon name="bot" size={20} /> : p.name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-body-lg">
                    {p.name}
                    {p.isBot && p.botDifficulty && <span className="meta"> ({DIFFICULTY_LABEL[p.botDifficulty]})</span>}
                  </span>
                  {handicapOn && !p.isBot && (
                    <button
                      type="button"
                      data-tolerance={toleranceOf(p)}
                      className={`chip m3-state-layer !min-h-[40px] !px-3 tabular ${toleranceOf(p) > 0 ? '!bg-md-secondary-container !text-md-on-secondary-container' : ''}`}
                      onClick={() => updatePlayer(i, { tolerance: nextTolerance(toleranceOf(p)) })}
                      aria-label={t.toleranceOf(p.name, toleranceOf(p))}
                    >
                      {t.toleranceChip(toleranceOf(p))}
                    </button>
                  )}
                  {!p.isBot && (
                    <button type="button" className="icon-btn m3-state-layer" onClick={() => removePlayer(i)} aria-label={t.removePlayer(p.name)}>
                      <Icon name="close" size={20} />
                    </button>
                  )}
                </m.li>
              ))}
            </AnimatePresence>
          </ul>

          <form onSubmit={onSubmit} className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor="player-name">
              {t.addName}
            </label>
            <input
              id="player-name"
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              maxLength={20}
              autoComplete="off"
              placeholder={t.addName}
              className="field flex-1"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'name-error' : undefined}
            />
            <button type="submit" className="btn btn-tonal m3-state-layer !px-4 min-h-[56px]" disabled={!name.trim()} aria-label={t.add}>
              <Icon name="add" />
            </button>
          </form>
          {nameError && (
            <p id="name-error" className="mt-2 text-body-sm text-md-error">
              {nameError}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label={t.earlierPlayers}>
              {suggestions.map((n) => (
                <button key={n} type="button" className="chip m3-state-layer" onClick={() => add(n)}>
                  <Icon name="add" size={18} />
                  {n}
                </button>
              ))}
            </div>
          )}
          {humans.length > 0 && (
            <div className="mt-4 flex items-start gap-4 rounded-m3-lg bg-md-surface-container-low px-4 py-3" data-handicap>
              <div className="flex-1 min-w-0">
                <h3 className="text-title-sm">{t.handicap}</h3>
                <p className="meta">{t.handicapHint}</p>
              </div>
              <Switch checked={handicapOn} onChange={switchHandicap} ariaLabel={t.handicap} />
            </div>
          )}
        </section>

        {/* Bots */}
        <AnimatePresence initial={false}>
          {canUseBots && (
            <m.section
              aria-labelledby="bots-h"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: spring.effectsDefault }}
              transition={spring.spatialDefault}
              className="overflow-hidden"
            >
              <div className="surface p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-md-surface-container-highest text-md-on-surface-variant">
                    <Icon name="bot" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 id="bots-h" className="text-title-md">
                      {t.botsHeading}
                    </h2>
                    <p className="meta">{t.botsHint}</p>
                  </div>
                  <Switch checked={botsOn} onChange={(on) => setBots(on)} ariaLabel={t.botsSwitch} />
                </div>
                {botsOn && (
                  <div className="space-y-3">
                    <SegmentedControl
                      label={t.count}
                      value={botCount}
                      onChange={(c) => {
                        setBotCount(c)
                        setBots(true, c, levels)
                      }}
                      segments={[1, 2, 3].map((c) => ({ value: c, label: t.bots(c) }))}
                    />
                    <BotLevels
                      bots={bots}
                      label={t.strengthOf}
                      onChange={(i, d) => {
                        const next = levels.map((l, j) => (j === i ? d : l))
                        setLevels(next)
                        setBots(true, botCount, next)
                      }}
                    />
                    <p className="meta">{t.formHint}</p>
                  </div>
                )}
              </div>
            </m.section>
          )}
        </AnimatePresence>

        {/* Teams */}
        <AnimatePresence initial={false}>
          {canUseTeams && (
            <m.section
              aria-labelledby="teams-h"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: spring.effectsDefault }}
              transition={spring.spatialDefault}
              className="overflow-hidden"
            >
              <div className="surface p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-md-surface-container-highest text-md-on-surface-variant">
                    <Icon name="groups" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 id="teams-h" className="text-title-md">
                      {t.teamsHeading}
                    </h2>
                    <p className="meta">{t.teamsHint}</p>
                  </div>
                  <Switch checked={teamsOn} onChange={setTeamsOn} ariaLabel={t.teamsHeading} />
                </div>
                {teamsActive && (
                  <div className="space-y-3">
                    {maxTeams(humanNames.length) > 2 && (
                      <SegmentedControl
                        label={t.teamCount}
                        value={Math.min(teamCount, maxTeams(humanNames.length))}
                        onChange={setTeamCount}
                        segments={Array.from({ length: maxTeams(humanNames.length) - 1 }, (_, i) => i + 2).map((n) => ({
                          value: n,
                          label: t.teams(n)
                        }))}
                      />
                    )}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {teams.map((members, i) => (
                        <li key={TEAMS[i].name} className="rounded-m3-lg bg-md-surface-container-high p-3">
                          <p className="flex items-center gap-2 text-title-sm mb-2">
                            <span className={`w-3 h-3 rounded-full ${TEAM_DOT[TEAMS[i].tone]}`} aria-hidden="true" />
                            {TEAMS[i].name}
                            <span className="meta ml-auto tabular">{members.length}</span>
                          </p>
                          <div className="flex flex-wrap gap-2 min-h-[40px]">
                            {members.length === 0 && <span className="meta self-center">{t.nobodyYet}</span>}
                            {members.map((name) => (
                              <m.button
                                key={name}
                                layout
                                layoutId={`team-member-${name}`}
                                transition={spring.spatialDefault}
                                type="button"
                                className="chip m3-state-layer"
                                onClick={() => moveToNextTeam(name)}
                                aria-label={t.moveToNextTeam(name)}
                              >
                                {name}
                              </m.button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-3">
                      <p className="meta">{t.moveHint}</p>
                      <button
                        type="button"
                        className="btn btn-text m3-state-layer shrink-0"
                        onClick={() => setTeams(splitIntoTeams(humanNames, teams.length || teamCount))}
                      >
                        <Icon name="shuffle" size={20} />
                        {t.shuffle}
                      </button>
                    </div>
                    {emptyTeam && <p className="text-body-sm text-md-error">{t.emptyTeam}</p>}
                  </div>
                )}
              </div>
            </m.section>
          )}
        </AnimatePresence>

          </>
        )}

        {/* The round */}
        <section aria-labelledby="round-h" className="space-y-5">
          <h2 id="round-h" className="text-title-md">
            {t.roundHeading}
          </h2>

          <div className="space-y-2">
            <SegmentedControl
              label={t.length}
              value={goal}
              onChange={(g) => setOptions({ goal: g })}
              segments={GOAL_OPTIONS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
            />
            <p className="meta">
              {gameMode === 'timeline_global'
                ? t.goalGlobal(goalWord(goal))
                : timelineMode
                  ? t.goalPersonal(goalWord(goal))
                  : t.goalHardcore(goalWord(goal), teamsActive)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="decades-h" className="text-title-sm">
                {t.decades}
              </h3>
              <span className="meta tabular">{t.songs(poolSize)}</span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="decades-h">
              <button
                type="button"
                className={`chip m3-state-layer`}
                aria-pressed={decades.length === 0}
                onClick={() => setOptions({ decades: [] })}
              >
                {decades.length === 0 && <Icon name="check" size={18} />}
                {t.all}
              </button>
              {DECADES_WITH_SONGS.map((d) => {
                const on = decades.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    className={`chip m3-state-layer`}
                    aria-pressed={on}
                    onClick={() => toggleDecade(d)}
                    aria-label={t.decadeChip(decadeLabel(d), byDecade[d] ?? 0)}
                  >
                    {on && <Icon name="check" size={18} />}
                    {decadeLabel(d)}
                  </button>
                )
              })}
            </div>
            {poolSize < songsNeeded && (
              <p className="meta">{t.poolTight}</p>
            )}
            <p className="meta">{t.recentHint}</p>
          </div>


          <div className="space-y-2">
            <h3 id="genres-h" className="text-title-sm">
              {t.genres}
            </h3>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="genres-h">
              <button type="button" className="chip m3-state-layer" aria-pressed={genres.length === 0} onClick={() => setOptions({ genres: [] })}>
                {genres.length === 0 && <Icon name="check" size={18} />}
                {t.all}
              </button>
              {GENRE_GROUPS.map((g) => {
                const on = genres.includes(g)
                return (
                  <button key={g} type="button" className="chip m3-state-layer" aria-pressed={on} onClick={() => toggleGenre(g)}>
                    {on && <Icon name="check" size={18} />}
                    {t[`genre_${g}`]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h3 id="collection-h" className="text-title-sm">
              {t.collection}
            </h3>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="collection-h">
              {COLLECTIONS.map((c) => {
                const on = collection === c
                const locked = c === 'nemesis' && nemesisLocked
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-selected={on}
                    disabled={locked}
                    className="chip m3-state-layer disabled:opacity-50"
                    onClick={() => setOptions({ collection: c as Collection })}
                  >
                    {on && <Icon name="check" size={18} />}
                    {t[`collection_${c}`]}
                  </button>
                )
              })}
            </div>
            <p className="meta">
              {collection === 'nemesis' ? t.collectionHint_nemesis(missed.length) : t[`collectionHint_${collection}`]}
            </p>
            {missed.length < NEMESIS_MIN && <p className="meta">{t.nemesisLocked(missed.length, NEMESIS_MIN)}</p>}
          </div>

          {timelineMode && (
            <div className="surface p-4 flex items-start gap-4">
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-md-surface-container-highest text-md-on-surface-variant">
                <Icon name="hand" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-title-md">{t.challenge}</h3>
                <p className="meta">{t.challengeHint(teamsActive, STARTING_CHALLENGES)}</p>
              </div>
              <Switch checked={challengesEnabled} onChange={(on) => setOptions({ challengesEnabled: on })} ariaLabel={t.challenge} />
            </div>
          )}

          {timelineMode && (
            <div className="surface p-4 flex items-start gap-4">
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-md-surface-container-highest text-md-on-surface-variant">
                <Icon name="swap" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-title-md">{t.bonus}</h3>
                <p className="meta">{t.bonusHint(MAX_JOKERS)}</p>
              </div>
              <Switch checked={bonus} onChange={(on) => setOptions({ bonus: on })} ariaLabel={t.bonus} />
            </div>
          )}

          <div className="surface p-4 flex items-start gap-4">
            <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-md-surface-container-highest text-md-on-surface-variant">
              <Icon name="diamond" size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-title-md">{t.exotics}</h3>
              <p className="meta">{t.exoticsHint(EXOTIC_COUNT)}</p>
            </div>
            <Switch checked={exotics} onChange={(on) => setOptions({ exotics: on })} ariaLabel={t.exoticsSwitch} />
          </div>
        </section>
      </div>

      {/* Start */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:pl-24 bg-gradient-to-t from-md-surface via-md-surface/95 to-transparent pt-8 safe-bottom">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-4">
          <button type="button" className="btn btn-lg btn-brand m3-state-layer w-full" disabled={!ready || opening} onClick={start}>
            <Icon name="play" />
            {devices === 'own'
              ? opening
                ? t.opening
                : t.openRoom
              : ready
              ? t.go
              : emptyTeam
                ? t.teamNeedsSomeone
                : MIN_PLAYERS - players.length === 1
                  ? t.oneMore
                  : t.twoMore}
          </button>
        </div>
      </div>
    </div>
  )
}

/** One row per bot: its name and its own strength. */
function BotLevels({ bots, label, onChange }: { bots: Player[]; label: (name: string) => string; onChange: (index: number, level: Difficulty) => void }) {
  return (
    <ul className="space-y-2" data-bot-levels>
      {bots.map((b, i) => (
        <li key={b.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-m3-lg bg-md-surface-container-high px-3 py-2">
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <Icon name="bot" size={18} className="text-md-on-surface-variant shrink-0" />
            <span className="text-body-lg truncate">{b.name}</span>
          </span>
          <span className="w-full min-[440px]:w-auto">
            <SegmentedControl
              label={label(b.name)}
              value={b.botDifficulty ?? 'medium'}
              onChange={(d) => onChange(i, d)}
              segments={(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
