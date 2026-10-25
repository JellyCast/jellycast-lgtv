import { compareGenres, genreName } from '../i18n/genres'
import type { Episode, Movie, Series } from '../model/library'

export type ShelfKind =
    | { type: 'continue' }
    | { type: 'new' }
    | { type: 'notStarted' }
    | { type: 'genre'; name: string }

export interface Shelf<T> {
    key: string
    kind: ShelfKind
    items: T[]
}

const dayMs = 24 * 60 * 60 * 1000
const newSeriesWindowMs = 30 * dayMs
const newSeriesLimit = 20
const minGenreSize = 3

function shelfKey(kind: ShelfKind): string {
    return kind.type === 'genre' ? `genre-${kind.name}` : kind.type === 'notStarted' ? 'not-started' : kind.type
}

/** One shelf per translated genre with at least three titles, in UI-language order; items keep their order. */
export function genreShelves<T extends { genres: string[] }>(items: T[]): Shelf<T>[] {
    const groups = new Map<string, T[]>()
    for (const item of items) {
        for (const genre of item.genres) {
            const name = genreName(genre)
            const group = groups.get(name) ?? []
            group.push(item)
            groups.set(name, group)
        }
    }
    return [...groups.entries()]
        .filter(([, group]) => group.length >= minGenreSize)
        .sort(([a], [b]) => compareGenres(a, b))
        .map(([name, group]) => {
            const kind: ShelfKind = { type: 'genre', name }
            return { key: shelfKey(kind), kind, items: [...new Set(group)] }
        })
}

function newestFirstNullsLast(a: number | null, b: number | null): number {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return b - a
}

function shelf<T>(kind: ShelfKind, items: T[]): Shelf<T> {
    return { key: shelfKey(kind), kind, items }
}

/** Movies: Continue watching (last played first), New (every unwatched movie, newest first), then genres. */
export function movieShelves(movies: Movie[]): Shelf<Movie>[] {
    const resumed = movies
        .filter((movie) => movie.resumePositionMs > 0)
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    const unwatched = movies
        .filter((movie) => !movie.isPlayed)
        .sort((a, b) => newestFirstNullsLast(a.addedAt, b.addedAt))
    return [shelf({ type: 'continue' }, resumed), shelf({ type: 'new' }, unwatched), ...genreShelves(movies)].filter(
        (entry) => entry.items.length > 0,
    )
}

export type SeriesShelfItem = Episode | Series

/**
 * Series: Continue watching (next-up episodes), New (series with episodes added in the last 30 days),
 * Not started yet (A–Z), then genres.
 */
export function seriesShelves(series: Series[], nextUp: Episode[], now: number): Shelf<SeriesShelfItem>[] {
    const recent = series
        .filter((entry) => !entry.isPlayed && entry.lastEpisodeAddedAt !== null && entry.lastEpisodeAddedAt >= now - newSeriesWindowMs)
        .sort((a, b) => (b.lastEpisodeAddedAt ?? 0) - (a.lastEpisodeAddedAt ?? 0))
        .slice(0, newSeriesLimit)
    const following = new Set(nextUp.map((episode) => episode.seriesId))
    const notStarted = series.filter((entry) => !entry.hasPlayedEpisodes && !following.has(entry.id))
    return [
        shelf<SeriesShelfItem>({ type: 'continue' }, nextUp),
        shelf<SeriesShelfItem>({ type: 'new' }, recent),
        shelf<SeriesShelfItem>({ type: 'notStarted' }, notStarted),
        ...genreShelves(series),
    ].filter((entry) => entry.items.length > 0)
}
