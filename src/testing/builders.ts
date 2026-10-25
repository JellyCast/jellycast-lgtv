import type { Episode, Movie, Series } from '../core/model/library'

const noArtwork = { poster: null, landscape: null, backdrop: null, logo: null, backdrops: [] }

export function movie(id: string, overrides: Partial<Movie> = {}): Movie {
    return {
        kind: 'movie',
        id,
        title: id,
        year: 2020,
        runtimeMs: 6_000_000,
        overview: null,
        genres: [],
        ageRating: null,
        resumePositionMs: 0,
        isPlayed: false,
        lastPlayedAt: null,
        addedAt: null,
        artwork: noArtwork,
        spine: { posterUrl: null, logoUrl: null, color: '#222', isLight: false, darkColor: '#222' },
        tech: { resolution: null, dynamicRange: null, hasAtmos: false },
        communityRating: null,
        ...overrides,
    }
}

export function series(id: string, overrides: Partial<Series> = {}): Series {
    return {
        kind: 'series',
        id,
        title: id,
        year: 2020,
        overview: null,
        genres: [],
        ageRating: null,
        seasonCount: 1,
        lastEpisodeAddedAt: null,
        isPlayed: false,
        hasPlayedEpisodes: false,
        artwork: noArtwork,
        communityRating: null,
        ...overrides,
    }
}

export function episode(id: string, seasonNumber: number, episodeNumber: number, overrides: Partial<Episode> = {}): Episode {
    return {
        kind: 'episode',
        id,
        title: id,
        seriesId: 's1',
        seriesTitle: 'Series',
        seasonId: `season-${seasonNumber}`,
        seasonNumber,
        episodeNumber,
        runtimeMs: 3_000_000,
        overview: null,
        resumePositionMs: 0,
        isPlayed: false,
        lastPlayedAt: null,
        addedAt: null,
        artwork: noArtwork,
        stillUrl: null,
        touchedAt: null,
        ...overrides,
    }
}

export const day = 24 * 60 * 60 * 1000
