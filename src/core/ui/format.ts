import { genreName } from '../i18n/genres'
import { plural, t } from '../i18n/i18n'
import type { DynamicRange, Episode, Movie, Resolution, Series } from '../model/library'
import { remainingMs } from '../model/library'

const msPerMinute = 60_000

/** "S3 · E4", or empty without numbers. */
export function episodeCode(season: number | null, episode: number | null): string {
    return season !== null && episode !== null ? t('episode_code', season, episode) : ''
}

/** "2 h 49 min" or "52 min", minutes rounded half up. */
export function runtimeText(ms: number): string {
    const totalMinutes = Math.floor((ms + msPerMinute / 2) / msPerMinute)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? t('runtime_hours_minutes', hours, minutes) : t('runtime_minutes', minutes)
}

export function remainingText(ms: number): string {
    return t('runtime_remaining', runtimeText(ms))
}

export function seasonCountText(count: number): string {
    return plural('season_count', count, count)
}

export function resolutionLabel(resolution: Resolution): string {
    return t(resolution === 'UHD' ? 'tech_4k' : resolution === 'HD' ? 'tech_hd' : 'tech_sd')
}

/** "DV" or "HDR", for a spine. */
export function dynamicRangeShortLabel(range: DynamicRange): string {
    return t(range === 'DolbyVision' ? 'tech_dv_short' : 'tech_hdr_short')
}

export function dynamicRangeLabel(range: DynamicRange): string {
    switch (range) {
        case 'DolbyVision':
            return t('tech_dolby_vision')
        case 'Hdr10Plus':
            return t('tech_hdr10_plus')
        case 'Hdr10':
            return t('tech_hdr10')
        case 'Hlg':
            return t('tech_hlg')
    }
}

/** Movie meta after the year: runtime, the first two genres, the age rating. */
export function movieMetaParts(movie: Movie): string[] {
    const parts: string[] = []
    if (movie.runtimeMs) parts.push(runtimeText(movie.runtimeMs))
    if (movie.genres.length) parts.push(movie.genres.slice(0, 2).map(genreName).join(', '))
    if (movie.ageRating) parts.push(movie.ageRating)
    return parts
}

/** Series meta: year, season count, first genre, age rating. */
export function seriesMetaParts(series: Series): string[] {
    const parts: string[] = []
    if (series.year) parts.push(String(series.year))
    if (series.seasonCount && series.seasonCount > 0) parts.push(seasonCountText(series.seasonCount))
    if (series.genres.length) parts.push(genreName(series.genres[0]))
    if (series.ageRating) parts.push(series.ageRating)
    return parts
}

/** Episode time: what is left when in progress, otherwise the runtime. */
export function episodeTime(episode: Episode): string | null {
    const left = remainingMs(episode.resumePositionMs, episode.runtimeMs)
    if (left !== null) return remainingText(left)
    return episode.runtimeMs ? runtimeText(episode.runtimeMs) : null
}

export const separator = '  ·  '
