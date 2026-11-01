/**
 * Alle Songs — every song of the catalogue (admin corrections applied, taken
 * out songs gone) as cover tiles or a list. Search forgives typos, sorting and
 * filters live in the address, so a reload or the way back keeps them.
 * The model is pure and tested: songLibraryModel.ts.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Song } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { SongWishButton, SongWishCorner } from '@/components/library/SongWish'
import { wishText } from '@/i18n/messages/wishes'
import { SongTile, SongRow } from '@/components/library/SongTile'
import { SongDetail } from '@/components/library/SongDetail'
import { allSongs } from '@/data/catalogue'
import { songRates } from '@/game/stats'
import { GENRE_GROUPS, type GenreGroup } from '@/game/songPool'
import { useGameHistory } from '@/contexts/GameHistoryContext'
import { useUI } from '@/contexts'
import { localeOf, useLang, useMessages } from '@/i18n'
import { libraryText } from '@/i18n/messages/library'
import { setupText } from '@/i18n/messages/setup'
import {
  SORT_KEYS,
  NO_FILTERS,
  decadeOf,
  decadeSections,
  effectiveSort,
  indexSongs,
  passes,
  readState,
  searchSongs,
  sortHits,
  suggestion,
  writeState,
  type Collection,
  type Filters,
  type LibraryState
} from './songLibraryModel'

const VIEW_KEY = 'mxtape_library_view'
const SEARCH_DELAY_MS = 120

function storedView(): 'grid' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function activeFilters(f: Filters): number {
  return f.decades.length + f.genres.length + (f.collection !== 'all' ? 1 : 0) + (f.exotics ? 0 : 1)
}

export function SongLibraryScreen() {
  const t = useMessages(libraryText)
  const w = useMessages(wishText)
  const setup = useMessages(setupText)
  const { lang } = useLang()
  const { showModal } = useUI()
  const { history } = useGameHistory()
  const [params, setParams] = useSearchParams()
  const state = readState(params)
  const [typed, setTyped] = useState(state.q)
  const [view, setView] = useState(storedView)
  const [showFilters, setShowFilters] = useState(activeFilters(state.filters) > 0)

  const catalogue = useMemo(() => allSongs(), [])
  const index = useMemo(() => indexSongs(catalogue), [catalogue])
  const rates = useMemo(() => songRates(history), [history])
  const decades = useMemo(() => [...new Set(catalogue.map((s) => decadeOf(s.year)))].sort(), [catalogue])

  const update = (next: Partial<LibraryState>) => setParams(writeState({ ...state, ...next }), { replace: true })

  // The address follows the typing after a short pause
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    if (typed === latest.current.q) return
    const id = window.setTimeout(() => setParams(writeState({ ...latest.current, q: typed }), { replace: true }), SEARCH_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [typed, setParams])

  const sort = effectiveSort(state)
  const hits = useMemo(() => {
    const found = searchSongs(index, state.q).filter((h) => passes(h.item.song, state.filters))
    return sortHits(found, sort, sort === 'relevance' ? 'asc' : state.dir, rates, localeOf(lang))
  }, [index, state.q, state.filters, sort, state.dir, rates, lang])
  const sections = sort === 'year' ? decadeSections(hits) : [{ decade: 0, hits }]
  const hint = hits.length === 0 ? suggestion(index, state.q) : null

  const setFilters = (f: Partial<Filters>) => update({ filters: { ...state.filters, ...f } })
  const toggleIn = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const open = (song: Song) => showModal(song.title, <SongDetail song={song} rate={rates.get(song.id)} />)

  const chooseView = (v: 'grid' | 'list') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }

  // Section heads stick right under the search bar, whatever its height
  const bar = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(0)
  useEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filtersOn = activeFilters(state.filters)

  return (
    // A destination of its own: on phones the top bar (4rem) sits above the search, on wider screens nothing
    <div className="pb-8 pt-4 md:pt-10 [--lib-head:4rem] md:[--lib-head:0px]" style={{ '--lib-top': `calc(var(--lib-head) + ${barHeight}px)` } as CSSProperties}>
      <h1 className="text-headline-md mb-3">{t.title}</h1>

      <div ref={bar} className="sticky top-[var(--lib-head)] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 pt-2 bg-md-surface/90 backdrop-blur-md space-y-3">
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-md-on-surface-variant pointer-events-none" />
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            className="field !pl-12 !pr-12 [&::-webkit-search-cancel-button]:appearance-none"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          {typed && (
            <button
              type="button"
              className="icon-btn m3-state-layer absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setTyped('')}
              aria-label={t.clearSearch}
            >
              <Icon name="close" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            label={t.sortLabel}
            value={sort}
            options={SORT_KEYS.filter((k) => k !== 'relevance' || state.q.trim()).map((k) => ({ value: k, label: t[`sort_${k}`] }))}
            onChange={(k) => update({ sort: k })}
            leading={<Icon name="sort" size={18} className="hidden min-[360px]:block shrink-0" />}
            className="shrink-0"
            buttonClassName="!pr-2 max-w-[11.5rem]"
          />
          {sort !== 'relevance' && (
            <button
              type="button"
              className="icon-btn m3-state-layer shrink-0"
              onClick={() => update({ sort, dir: state.dir === 'asc' ? 'desc' : 'asc' })}
              aria-label={state.dir === 'asc' ? t.ascending : t.descending}
              data-sort-dir={state.dir}
            >
              <Icon name={state.dir === 'asc' ? 'arrowUp' : 'arrowDown'} />
            </button>
          )}
          <button
            type="button"
            className="chip m3-state-layer shrink-0"
            aria-expanded={showFilters}
            data-selected={filtersOn > 0}
            onClick={() => setShowFilters((v) => !v)}
          >
            {t.filters}
            {filtersOn > 0 && (
              <>
                <span className="grid place-items-center min-w-5 h-5 px-1 rounded-m3-full bg-md-primary text-md-on-primary text-label-sm tabular" aria-hidden="true">
                  {filtersOn}
                </span>
                <span className="sr-only">{t.filtersActive(filtersOn)}</span>
              </>
            )}
          </button>
        </div>

      </div>

      {showFilters && (
        <div className="space-y-3 surface p-4 mt-2" data-filters>
          <FilterGroup label={t.decades}>
            {decades.map((d) => (
              <button key={d} type="button" className="chip m3-state-layer" aria-pressed={state.filters.decades.includes(d)} onClick={() => setFilters({ decades: toggleIn(state.filters.decades, d) })}>
                {t.decade(d)}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label={t.genres}>
            {GENRE_GROUPS.map((g: GenreGroup) => (
              <button key={g} type="button" className="chip m3-state-layer" aria-pressed={state.filters.genres.includes(g)} onClick={() => setFilters({ genres: toggleIn(state.filters.genres, g) })}>
                {setup[`genre_${g}`]}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label={t.collection}>
            {(['all', 'party', 'german'] as Collection[]).map((c) => (
              <button key={c} type="button" className="chip m3-state-layer" aria-pressed={state.filters.collection === c} onClick={() => setFilters({ collection: c })}>
                {t[`collection_${c}`]}
              </button>
            ))}
            <button type="button" className="chip m3-state-layer" aria-pressed={state.filters.exotics} onClick={() => setFilters({ exotics: !state.filters.exotics })}>
              {t.exotics}
            </button>
          </FilterGroup>
          {filtersOn > 0 && (
            <button type="button" className="btn btn-text m3-state-layer -ml-3" onClick={() => update({ filters: NO_FILTERS })}>
              {t.resetFilters}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <p className="meta tabular" aria-live="polite" data-count>
          {t.count(hits.length, catalogue.length)}
        </p>
          <div className="flex shrink-0 -my-2 -mr-3" role="group">
            <button
              type="button"
              className="icon-btn m3-state-layer"
              aria-pressed={view === 'grid'}
              aria-label={t.viewGrid}
              onClick={() => chooseView('grid')}
              data-selected={view === 'grid'}
            >
              <Icon name="grid" className={view === 'grid' ? 'text-md-primary' : 'text-md-on-surface-variant'} />
            </button>
            <button
              type="button"
              className="icon-btn m3-state-layer"
              aria-pressed={view === 'list'}
              aria-label={t.viewList}
              onClick={() => chooseView('list')}
            >
              <Icon name="list" className={view === 'list' ? 'text-md-primary' : 'text-md-on-surface-variant'} />
            </button>
          </div>
      </div>

      {hits.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title={t.nothingTitle}
            text={t.nothingText}
            action={
              hint || state.q.trim() ? (
              <div className="flex flex-wrap justify-center gap-2">
                {hint && (
                  <button type="button" className="btn btn-tonal m3-state-layer" onClick={() => setTyped(hint)}>
                    {t.didYouMean(hint)}
                  </button>
                )}
                {/* Not in the game: ask for it, the search as the title */}
                {state.q.trim() && (
                  <SongWishButton
                    className={hint ? 'btn btn-text m3-state-layer' : 'btn btn-tonal m3-state-layer'}
                    prefill={{ title: state.q.trim() }}
                    label={w.wishFor(state.q.trim())}
                  />
                )}
              </div>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-2 space-y-6" key={`${sort}-${state.dir}-${view}`}>
          {sections.map(({ decade, hits: part }) => (
            <section key={decade} aria-label={decade ? t.decadeHead(decade) : undefined}>
              {decade > 0 && (
                <h2
                  className="sticky z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-2 flex items-baseline gap-3 bg-md-surface/90 backdrop-blur-md"
                  style={{ top: 'var(--lib-top)' }}
                  data-decade-head
                >
                  <span className="text-poster text-headline-sm">{t.decadeHead(decade)}</span>
                  <span className="text-label-lg text-md-on-surface-variant">{t.songs(part.length)}</span>
                </h2>
              )}
              {view === 'grid' ? (
                <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-4 stagger-children">
                  {part.map(({ item }) => (
                    <li key={item.song.id} className="lib-item">
                      <SongTile song={item.song} onOpen={open} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2 stagger-children">
                  {part.map(({ item }) => (
                    <li key={item.song.id} className="lib-item lib-item-row">
                      <SongRow song={item.song} onOpen={open} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      <div className="mt-8">
        <SongWishCorner />
      </div>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="text-label-lg text-md-on-surface-variant mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
