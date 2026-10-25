import { memo } from 'preact/compat'
import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { advanceBackdrops, pickBackdrop } from '../../core/data/backdrops'
import { useSettings } from '../../core/data/settings'
import { movieShelves, type Shelf } from '../../core/data/shelves'
import { useLoad } from '../../core/data/useLoad'
import { t } from '../../core/i18n/i18n'
import type { Movie } from '../../core/model/library'
import { useNavigator } from '../../core/navigation/Navigator'
import type { SectionProps } from '../home/sectionProps'
import { Bookcase } from './Bookcase'
import { MovieBrowse } from './MovieBrowse'
import { ShelfIndicator } from './ShelfIndicator'

export function shelfTitle(shelf: Shelf<Movie>): string {
    switch (shelf.kind.type) {
        case 'continue':
            return t('shelf_continue')
        case 'new':
            return t('movies_shelf_new')
        case 'genre':
            return shelf.kind.name
        default:
            return ''
    }
}

export interface MoviesState {
    shelves: Shelf<Movie>[]
    shelf: number
    index: number
}

/** Movies: the same shelves in two views, chosen in Settings (detail view by default). */
export const MoviesSection = memo(function MoviesSection({ focused, visible, resetKey, onAccessory }: SectionProps & { onAccessory: (node: ComponentChildren) => void }) {
    const { library } = useApp()
    const navigator = useNavigator()
    const settings = useSettings()
    const { state, retry, setData } = useLoad('movies', () => library.getMovies(), visible)
    const movies = state.kind === 'ready' ? state.data : []
    const shelves = useMemo(() => movieShelves(movies), [movies])
    const [position, setPosition] = useState({ shelf: 0, index: 0 })
    const shelfKey = useRef<string | null>(null)

    useEffect(() => setPosition({ shelf: 0, index: 0 }), [resetKey])
    useEffect(() => {
        if (!visible) advanceBackdrops(movies.map((movie) => movie.id))
    }, [visible])
    // After a rebuild the shelf follows its kind when it still exists, otherwise the old index, clamped.
    useEffect(() => {
        if (!shelves.length) return
        setPosition((current) => {
            const byKey = shelves.findIndex((shelf) => shelf.key === shelfKey.current)
            const shelf = byKey >= 0 ? byKey : Math.min(current.shelf, shelves.length - 1)
            return { shelf, index: Math.min(current.index, shelves[shelf].items.length - 1) }
        })
    }, [shelves])
    shelfKey.current = shelves[position.shelf]?.key ?? shelfKey.current

    useEffect(() => {
        onAccessory(shelves.length ? <ShelfIndicator names={shelves.map(shelfTitle)} current={position.shelf} /> : null)
    }, [shelves, position.shelf])
    useEffect(() => () => onAccessory(null), [])

    const replaceMovie = (movie: Movie) => setData(movies.map((entry) => (entry.id === movie.id ? movie : entry)))
    const setWatched = async (movie: Movie, played: boolean) => {
        const previous = movie
        replaceMovie({ ...movie, isPlayed: played, resumePositionMs: 0 })
        try {
            await library.setPlayed(movie.id, played)
        } catch {
            replaceMovie(previous)
        }
    }

    const props = {
        shelves,
        position,
        loading: state.kind === 'loading',
        error: state.kind === 'error' || (state.kind === 'ready' && shelves.length === 0),
        focused,
        visible,
        resetKey,
        onMove: setPosition,
        onRetry: retry,
        onPlay: (movie: Movie, fromStart: boolean) => navigator.push({ name: 'player', itemId: movie.id, fromStart }),
        onDetails: (movie: Movie) => navigator.push({ name: 'movie', movieId: movie.id }),
        onWatched: setWatched,
        backdropOf: (movie: Movie) => pickBackdrop(movie.id, movie.artwork.backdrops, movie.artwork.backdrop),
    }
    return settings.movieView === 'bookcase' ? <Bookcase {...props} /> : <MovieBrowse {...props} />
})

export type MovieViewProps = {
    shelves: Shelf<Movie>[]
    position: { shelf: number; index: number }
    loading: boolean
    error: boolean
    focused: boolean
    visible: boolean
    resetKey: number
    onMove: (position: { shelf: number; index: number }) => void
    onRetry: () => void
    onPlay: (movie: Movie, fromStart: boolean) => void
    onDetails: (movie: Movie) => void
    onWatched: (movie: Movie, played: boolean) => void
    backdropOf: (movie: Movie) => string | null
}
