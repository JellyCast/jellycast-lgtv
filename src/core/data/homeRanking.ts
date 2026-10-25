import type { Episode, Movie, Playable } from '../model/library'

export type SuggestionReason = 'ContinueWatching' | 'NewEpisode' | 'NextEpisode' | 'RecentlyAdded' | 'ForTonight'

export interface Candidate {
    item: Playable
    reason: SuggestionReason
}

export const homeStackSize = 5
const dayMs = 24 * 60 * 60 * 1000
const recentlyInProgressMs = 3 * dayMs
const newEpisodeMs = 14 * dayMs
const stillWatchingMs = 30 * dayMs
const recentlyAddedMs = 30 * dayMs

interface Continuing {
    item: Playable
    touchedAt: number | null
    reason: SuggestionReason
}

function continuingReason(item: Playable): SuggestionReason {
    if (item.resumePositionMs > 0) return 'ContinueWatching'
    return item.kind === 'movie' ? 'RecentlyAdded' : 'NextEpisode'
}

/**
 * The Home stack: recently in progress (3 days), new episodes of followed series (14 days), still
 * watching (30 days), recently added movies (30 days), then the fallback. The first group an item
 * appears in decides its reason; at most five.
 */
export function rankHome(
    nextUp: Episode[],
    resumeMovies: Movie[],
    newMovies: Movie[],
    randomMovie: Movie | null,
    now: number,
): Candidate[] {
    const continuing: Continuing[] = [
        ...resumeMovies.map((movie) => ({ item: movie as Playable, touchedAt: movie.lastPlayedAt, reason: continuingReason(movie) })),
        ...nextUp.map((episode) => ({ item: episode as Playable, touchedAt: episode.touchedAt, reason: continuingReason(episode) })),
    ].sort((a, b) => (b.touchedAt ?? 0) - (a.touchedAt ?? 0))
    const touchedWithin = (entry: Continuing, windowMs: number) => entry.touchedAt !== null && now - entry.touchedAt <= windowMs

    const newEpisodes = nextUp
        .filter(
            (episode) =>
                episode.addedAt !== null &&
                episode.touchedAt !== null &&
                episode.resumePositionMs === 0 &&
                !episode.isPlayed &&
                episode.addedAt > episode.touchedAt &&
                now - episode.addedAt <= newEpisodeMs,
        )
        .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    const recentlyAdded = newMovies
        .filter((movie) => !movie.isPlayed && movie.resumePositionMs === 0 && movie.addedAt !== null && now - movie.addedAt <= recentlyAddedMs)
        .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))

    const groups: Candidate[] = [
        ...continuing
            .filter((entry) => entry.reason === 'ContinueWatching' && touchedWithin(entry, recentlyInProgressMs))
            .map((entry) => ({ item: entry.item, reason: entry.reason })),
        ...newEpisodes.map((episode) => ({ item: episode as Playable, reason: 'NewEpisode' as const })),
        ...continuing.filter((entry) => touchedWithin(entry, stillWatchingMs)).map((entry) => ({ item: entry.item, reason: entry.reason })),
        ...recentlyAdded.map((movie) => ({ item: movie as Playable, reason: 'RecentlyAdded' as const })),
        ...continuing.map((entry) => ({ item: entry.item, reason: entry.reason })),
        ...(randomMovie ? [{ item: randomMovie as Playable, reason: 'ForTonight' as const }] : []),
    ]
    const seen = new Set<string>()
    return groups.filter((candidate) => !seen.has(candidate.item.id) && !!seen.add(candidate.item.id)).slice(0, homeStackSize)
}
