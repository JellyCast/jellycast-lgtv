export type Resolution = 'UHD' | 'HD' | 'SD'
export type DynamicRange = 'DolbyVision' | 'Hdr10Plus' | 'Hdr10' | 'Hlg'

export interface Artwork {
    poster: string | null
    landscape: string | null
    backdrop: string | null
    logo: string | null
    backdrops: string[]
}

export interface MediaTech {
    resolution: Resolution | null
    dynamicRange: DynamicRange | null
    hasAtmos: boolean
}

export interface Spine {
    posterUrl: string | null
    logoUrl: string | null
    /** CSS color of the spine; light when the logo is dark. */
    color: string
    isLight: boolean
    darkColor: string
}

export interface Movie {
    kind: 'movie'
    id: string
    title: string
    year: number | null
    runtimeMs: number | null
    overview: string | null
    genres: string[]
    ageRating: string | null
    resumePositionMs: number
    isPlayed: boolean
    lastPlayedAt: number | null
    addedAt: number | null
    artwork: Artwork
    spine: Spine
    tech: MediaTech
    communityRating: number | null
}

export interface Series {
    kind: 'series'
    id: string
    title: string
    year: number | null
    overview: string | null
    genres: string[]
    ageRating: string | null
    seasonCount: number | null
    lastEpisodeAddedAt: number | null
    isPlayed: boolean
    hasPlayedEpisodes: boolean
    artwork: Artwork
    communityRating: number | null
}

export interface Episode {
    kind: 'episode'
    id: string
    title: string
    seriesId: string
    seriesTitle: string
    seasonId: string | null
    seasonNumber: number | null
    episodeNumber: number | null
    runtimeMs: number | null
    overview: string | null
    resumePositionMs: number
    isPlayed: boolean
    lastPlayedAt: number | null
    addedAt: number | null
    artwork: Artwork
    stillUrl: string | null
    /** Set by next-up only: when the user last touched this series. */
    touchedAt: number | null
}

export type Playable = Movie | Episode

export function withBackdrop(artwork: Artwork, index: number): Artwork {
    const backdrop = artwork.backdrops[index] ?? artwork.backdrop
    return backdrop === artwork.backdrop ? artwork : { ...artwork, backdrop }
}

export function isStarted(item: { isPlayed: boolean; resumePositionMs: number }): boolean {
    return item.isPlayed || item.resumePositionMs > 0
}

export function progressOf(positionMs: number, runtimeMs: number | null): number | null {
    if (positionMs <= 0 || !runtimeMs || runtimeMs <= 0) return null
    return Math.min(1, Math.max(0, positionMs / runtimeMs))
}

export function remainingMs(positionMs: number, runtimeMs: number | null): number | null {
    if (positionMs <= 0 || runtimeMs === null) return null
    return Math.max(runtimeMs - positionMs, 0)
}

function isRegular(episode: Episode): boolean {
    return (episode.seasonNumber ?? 0) > 0
}

export function compareEpisodes(a: Episode, b: Episode): number {
    return (
        (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
        (a.episodeNumber ?? Number.MAX_SAFE_INTEGER) - (b.episodeNumber ?? Number.MAX_SAFE_INTEGER)
    )
}

export function regularEpisodesInOrder(episodes: Episode[]): Episode[] {
    return episodes.filter(isRegular).sort(compareEpisodes)
}

/**
 * The most recently touched episode if in progress, else the first unplayed one after it; null when
 * nothing was started or everything after it is played. Ties (a whole season marked at once) or
 * missing times go to the latest episode. `episodes` may be a subset containing that episode.
 */
export function continueEpisode(episodes: Episode[]): Episode | null {
    const ordered = regularEpisodesInOrder(episodes)
    let lastIndex = -1
    ordered.forEach((episode, index) => {
        if (!isStarted(episode)) return
        if (lastIndex < 0 || (episode.lastPlayedAt ?? 0) >= (ordered[lastIndex].lastPlayedAt ?? 0)) lastIndex = index
    })
    if (lastIndex < 0) return null
    if (!ordered[lastIndex].isPlayed) return ordered[lastIndex]
    return ordered.slice(lastIndex + 1).find((episode) => !episode.isPlayed) ?? null
}

/** The next regular episode in (season, episode) order, played or not. */
export function nextEpisodeAfter(episodes: Episode[], current: Episode): Episode | null {
    const ordered = regularEpisodesInOrder(episodes)
    const index = ordered.findIndex((episode) => episode.id === current.id)
    return index >= 0 ? ordered[index + 1] ?? null : null
}

export const ticksPerMs = 10_000

export function ticksToMs(ticks: number | null | undefined): number | null {
    return ticks === null || ticks === undefined ? null : Math.floor(ticks / ticksPerMs)
}
