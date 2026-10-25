import { NeonEffect } from '../../core/design/components/NeonEffect'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { memo } from 'preact/compat'
import { useApp } from '../../app/AppContext'
import { nextSort, searchTitles, sortItems } from '../../core/data/library.search'
import { updateSettings, useSettings, type LibrarySort } from '../../core/data/settings'
import { useLoad } from '../../core/data/useLoad'
import { ArtworkImage } from '../../core/design/components/Artwork'
import { ChoiceChip, PillButton } from '../../core/design/components/Buttons'
import { ErrorState } from '../../core/design/components/Common'
import { SkeletonBlock, useDelayedVisible } from '../../core/design/components/Skeleton'
import { TextField } from '../../core/design/components/TextField'
import { useKeyLayer } from '../../core/focus/hooks'
import { plural, t } from '../../core/i18n/i18n'
import type { Movie, Series } from '../../core/model/library'
import { useNavigator } from '../../core/navigation/Navigator'
import type { SectionProps } from '../home/sectionProps'
import './library.css'

type Control = 'movies' | 'series' | 'search' | 'sort'
const controls: Control[] = ['movies', 'series', 'search', 'sort']
const columns = 8
const lineHeight = 138 + 6 + 16 + 16
const sortLabels: Record<LibrarySort, string> = {
    title: 'library_sort_title',
    added: 'library_sort_added',
    year: 'library_sort_year',
    rating: 'library_sort_rating',
}

/** ↑ from the first line of the grid goes to the control above that column. */
function controlAbove(col: number): Control {
    return col === 0 ? 'movies' : col === 1 ? 'series' : col <= 3 ? 'search' : 'sort'
}

export const LibrarySection = memo(function LibrarySection({ focused, visible, resetKey }: SectionProps) {
    const { library } = useApp()
    const navigator = useNavigator()
    const settings = useSettings()
    const kind = settings.libraryKind
    const movies = useLoad<Movie[]>('library-movies', () => library.getMovies(), visible && kind === 'movies')
    const series = useLoad<Series[]>('library-series', () => library.getSeries(), visible && kind === 'series')
    const current = kind === 'movies' ? movies : series
    const [query, setQuery] = useState('')
    const [editing, setEditing] = useState(false)
    const [focus, setFocus] = useState<{ zone: 'controls'; control: Control } | { zone: 'grid'; index: number }>({ zone: 'grid', index: 0 })

    const items = useMemo<(Movie | Series)[]>(() => {
        const all: (Movie | Series)[] = current.state.kind === 'ready' ? current.state.data : []
        return sortItems(searchTitles(all, query), settings.librarySort)
    }, [current.state, query, settings.librarySort])

    useEffect(() => setFocus(items.length ? { zone: 'grid', index: 0 } : { zone: 'controls', control: kind }), [resetKey])
    useEffect(() => {
        if (focus.zone === 'grid' && focus.index >= items.length) {
            setFocus(items.length ? { zone: 'grid', index: items.length - 1 } : { zone: 'controls', control: kind })
        }
    }, [items.length])

    // ↓ from the section bar lands on the selected chip; the pointer keeps what it points at.
    const pointed = useRef(false)
    useEffect(() => {
        if (focused && !pointed.current) setFocus({ zone: 'controls', control: kind })
        pointed.current = false
    }, [focused])
    const point = (next: typeof focus) => {
        pointed.current = true
        setFocus(next)
    }

    const setKind = (next: 'movies' | 'series') => {
        if (next !== kind) updateSettings({ libraryKind: next })
    }
    const open = (item: Movie | Series) =>
        navigator.push(item.kind === 'movie' ? { name: 'movie', movieId: item.id } : { name: 'series', seriesId: item.id })
    const activate = (control: Control) => {
        if (control === 'movies' || control === 'series') setKind(control)
        else if (control === 'search') setEditing(true)
        else updateSettings({ librarySort: nextSort(settings.librarySort) })
    }

    useKeyLayer((key) => {
        if (!focused) return false
        if (current.state.kind === 'error') {
            if (key === 'enter') current.retry()
            return key === 'enter'
        }
        if (focus.zone === 'controls') {
            const index = controls.indexOf(focus.control)
            if (key === 'left' || key === 'right') {
                const next = controls[index + (key === 'left' ? -1 : 1)]
                if (next) setFocus({ zone: 'controls', control: next })
                return true
            }
            if (key === 'down') {
                if (items.length) setFocus({ zone: 'grid', index: 0 })
                return true
            }
            if (key === 'enter') {
                activate(focus.control)
                return true
            }
            return false
        }
        const { index } = focus
        switch (key) {
            case 'left':
                if (index % columns > 0) setFocus({ zone: 'grid', index: index - 1 })
                return true
            case 'right':
                if (index % columns < columns - 1 && index + 1 < items.length) setFocus({ zone: 'grid', index: index + 1 })
                return true
            case 'down':
                if (index + columns < items.length) setFocus({ zone: 'grid', index: index + columns })
                else if (Math.floor(index / columns) < Math.floor((items.length - 1) / columns)) setFocus({ zone: 'grid', index: items.length - 1 })
                return true
            case 'up':
                if (index >= columns) setFocus({ zone: 'grid', index: index - columns })
                else setFocus({ zone: 'controls', control: controlAbove(index) })
                return true
            case 'enter':
                if (items[index]) open(items[index])
                return true
            default:
                return false
        }
    })

    const all = current.state.kind === 'ready' ? current.state.data.length : 0
    const count = query.trim()
        ? t('library_found', items.length, query.trim())
        : plural(kind === 'movies' ? 'library_count_movies' : 'library_count_series', all)
    const isControl = (control: Control) => focused && focus.zone === 'controls' && focus.control === control
    const focusedIndex = focused && focus.zone === 'grid' ? focus.index : -1
    const line = focus.zone === 'grid' ? Math.floor(focus.index / columns) : 0
    const showSkeleton = useDelayedVisible(current.state.kind === 'loading')

    return (
        <div class="library">
            <div class="library-controls">
                <ChoiceChip label={t('library_kind_movies')} selected={kind === 'movies'} focused={isControl('movies')} onHover={() => point({ zone: 'controls', control: 'movies' })} onClick={() => setKind('movies')} />
                <ChoiceChip label={t('library_kind_series')} selected={kind === 'series'} focused={isControl('series')} onHover={() => point({ zone: 'controls', control: 'series' })} onClick={() => setKind('series')} />
                <div class="library-search">
                    <TextField
                        compact
                        icon="search"
                        placeholder={t('library_search')}
                        value={query}
                        onInput={setQuery}
                        focused={isControl('search')}
                        onHover={() => point({ zone: 'controls', control: 'search' })}
                        editing={editing}
                        onEditingChange={setEditing}
                        onMove={(direction) => direction === 'down' && items.length && setFocus({ zone: 'grid', index: 0 })}
                    />
                </div>
                <PillButton
                    compact
                    icon="sort"
                    label={t('library_sort', t(sortLabels[settings.librarySort]))}
                    focused={isControl('sort')}
                    onHover={() => point({ zone: 'controls', control: 'sort' })}
                    onClick={() => activate('sort')}
                />
                <div class="library-spacer" />
                <span class="body-small muted">{current.state.kind === 'ready' ? count : ''}</span>
            </div>
            <div class="library-grid-viewport">
                {current.state.kind === 'error' ? (
                    <ErrorState message={t('library_error')} focused={focused} onRetry={current.retry} />
                ) : current.state.kind === 'loading' ? (
                    showSkeleton && <LibrarySkeleton />
                ) : items.length === 0 ? (
                    <div class="body-medium muted">{t('library_nothing_found', query.trim())}</div>
                ) : (
                    <div class="library-grid" style={{ transform: `translateY(${-line * lineHeight}px)` }}>
                        {items.map((item, index) => (
                            <LibraryTile key={item.id} item={item} focused={index === focusedIndex} onHover={() => point({ zone: 'grid', index })} onClick={() => open(item)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
})

const LibraryTile = memo(function LibraryTile({ item, focused, onHover, onClick }: { item: Movie | Series; focused: boolean; onHover: () => void; onClick: () => void }) {
    return (
        <div class="library-tile">
            <div class={`card library-poster neon scale-105 ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
                {item.artwork.poster ? <ArtworkImage url={item.artwork.poster} fadeMs={100} /> : <span class="card-title body-small muted clamp-3">{item.title}</span>}
                {focused && <NeonEffect mode="halo" />}
            </div>
            <div class={`body-small ellipsis library-title ${focused ? '' : 'muted'}`}>{item.title}</div>
        </div>
    )
}, (previous, next) => previous.item === next.item && previous.focused === next.focused)

function LibrarySkeleton() {
    return (
        <div class="library-grid">
            {Array.from({ length: columns * 2 }, (_, index) => (
                <div class="library-tile">
                    <SkeletonBlock width={92} height={138} index={index} />
                </div>
            ))}
        </div>
    )
}
