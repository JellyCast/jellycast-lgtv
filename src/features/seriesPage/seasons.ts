import type { Episode } from '../../core/model/library'
import { continueEpisode, regularEpisodesInOrder } from '../../core/model/library'

export interface Season {
    number: number
    id: string | null
    episodes: Episode[]
}

/** Seasons 1, 2, … with specials (season 0) last; episodes by number, unnumbered last. */
export function groupSeasons(episodes: Episode[]): Season[] {
    const bySeason = new Map<number, Episode[]>()
    for (const episode of episodes) {
        const number = episode.seasonNumber ?? 0
        bySeason.set(number, [...(bySeason.get(number) ?? []), episode])
    }
    return [...bySeason.entries()]
        .sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
        .map(([number, list]) => ({
            number,
            id: list.find((episode) => episode.seasonId)?.seasonId ?? null,
            episodes: [...list].sort(
                (a, b) => (a.episodeNumber ?? Number.MAX_SAFE_INTEGER) - (b.episodeNumber ?? Number.MAX_SAFE_INTEGER),
            ),
        }))
}

/** The Continue target: where the user is, or else the first regular episode. */
export function continueOrFirst(episodes: Episode[]): Episode | null {
    return continueEpisode(episodes) ?? regularEpisodesInOrder(episodes)[0] ?? null
}

/** Marks played state locally, also resetting the resume position, as the server does. */
export function withPlayed(episodes: Episode[], matches: (episode: Episode) => boolean, played: boolean): Episode[] {
    return episodes.map((episode) => (matches(episode) ? { ...episode, isPlayed: played, resumePositionMs: 0 } : episode))
}
