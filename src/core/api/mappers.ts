import { decodableAudioCodecs } from '../playback/audioTrack'
import { defaultProfileOptions } from '../playback/deviceProfile'
import type { Artwork, DynamicRange, Episode, MediaTech, Movie, Resolution, Series, Spine } from '../model/library'
import { ticksToMs } from '../model/library'
import { spineColor } from '../model/spineColor'
import type { ItemDto, StreamDto } from './dto'
import { imageUrl, imageWidths, type ImageType } from './images'

const uhdMinWidth = 3200
const hdMinWidth = 1200
const atmosCodecs = decodableAudioCodecs(defaultProfileOptions)

function date(value: string | undefined): number | null {
    if (!value) return null
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
}

function ageRating(value: string | undefined): string | null {
    const trimmed = value?.trim().replace(/^NL-/, '') ?? ''
    return trimmed || null
}

function ownImage(server: string, item: ItemDto, type: ImageType, width: number): string | null {
    const tag = item.ImageTags?.[type]
    return tag ? imageUrl(server, item.Id, type, tag, width) : null
}

function blurHash(item: ItemDto, type: ImageType): string | null {
    const tag = item.ImageTags?.[type]
    return (tag && item.ImageBlurHashes?.[type]?.[tag]) || null
}

function backdrops(server: string, ownerId: string | undefined, tags: string[] | undefined): string[] {
    if (!ownerId || !tags) return []
    return tags.map((tag, index) => imageUrl(server, ownerId, 'Backdrop', tag, imageWidths.backdrop, index))
}

function artworkOf(server: string, item: ItemDto): Artwork {
    const all = backdrops(server, item.Id, item.BackdropImageTags)
    return {
        poster: ownImage(server, item, 'Primary', imageWidths.poster),
        landscape: ownImage(server, item, 'Thumb', imageWidths.landscape),
        backdrop: all[0] ?? null,
        logo: ownImage(server, item, 'Logo', imageWidths.logo),
        backdrops: all,
    }
}

function resolutionOf(width: number | undefined): Resolution | null {
    if (!width || width <= 0) return null
    return width >= uhdMinWidth ? 'UHD' : width >= hdMinWidth ? 'HD' : 'SD'
}

function dynamicRangeOf(rangeType: string | undefined): DynamicRange | null {
    if (!rangeType) return null
    if (rangeType.startsWith('DOVI')) return 'DolbyVision'
    if (rangeType === 'HDR10Plus') return 'Hdr10Plus'
    if (rangeType === 'HDR10') return 'Hdr10'
    if (rangeType === 'HLG') return 'Hlg'
    return null
}

/** Atmos counts only on a track the TVs decode (EAC3 JOC); TrueHD Atmos never plays as Atmos here. */
function techOf(item: ItemDto): MediaTech {
    const streams: StreamDto[] = item.MediaStreams ?? []
    const video = streams.find((stream) => stream.Type === 'Video')
    return {
        resolution: resolutionOf(video?.Width ?? item.Width),
        dynamicRange: dynamicRangeOf(video?.VideoRangeType),
        hasAtmos: streams.some(
            (stream) =>
                stream.Type === 'Audio' &&
                stream.AudioSpatialFormat === 'DolbyAtmos' &&
                atmosCodecs.includes((stream.Codec ?? '').toLowerCase()),
        ),
    }
}

function spineOf(server: string, item: ItemDto): Spine {
    return {
        posterUrl: ownImage(server, item, 'Primary', imageWidths.spinePoster),
        logoUrl: ownImage(server, item, 'Logo', imageWidths.spineLogo),
        ...spineColor(blurHash(item, 'Primary'), blurHash(item, 'Logo')),
    }
}

export function toMovie(server: string, item: ItemDto): Movie {
    return {
        kind: 'movie',
        id: item.Id,
        title: item.Name ?? '',
        year: item.ProductionYear ?? null,
        runtimeMs: ticksToMs(item.RunTimeTicks),
        overview: item.Overview ?? null,
        genres: item.Genres ?? [],
        ageRating: ageRating(item.OfficialRating),
        resumePositionMs: ticksToMs(item.UserData?.PlaybackPositionTicks) ?? 0,
        isPlayed: item.UserData?.Played ?? false,
        lastPlayedAt: date(item.UserData?.LastPlayedDate),
        addedAt: date(item.DateCreated),
        artwork: artworkOf(server, item),
        spine: spineOf(server, item),
        tech: techOf(item),
        communityRating: item.CommunityRating ?? null,
    }
}

export function toSeries(server: string, item: ItemDto): Series {
    return {
        kind: 'series',
        id: item.Id,
        title: item.Name ?? '',
        year: item.ProductionYear ?? null,
        overview: item.Overview ?? null,
        genres: item.Genres ?? [],
        ageRating: ageRating(item.OfficialRating),
        seasonCount: item.ChildCount ?? null,
        lastEpisodeAddedAt: date(item.DateLastMediaAdded),
        isPlayed: item.UserData?.Played ?? false,
        hasPlayedEpisodes: (item.UserData?.Played ?? false) || (item.UserData?.PlayedPercentage ?? 0) > 0,
        artwork: artworkOf(server, item),
        communityRating: item.CommunityRating ?? null,
    }
}

export function toEpisode(server: string, item: ItemDto): Episode {
    const thumbTag = item.ParentThumbImageTag
    const landscape =
        item.ParentThumbItemId && thumbTag
            ? imageUrl(server, item.ParentThumbItemId, 'Thumb', thumbTag, imageWidths.landscape)
            : ownImage(server, item, 'Primary', imageWidths.landscape)
    const parentBackdrops = backdrops(server, item.ParentBackdropItemId, item.ParentBackdropImageTags)
    const logo =
        item.ParentLogoItemId && item.ParentLogoImageTag
            ? imageUrl(server, item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, imageWidths.logo)
            : null
    return {
        kind: 'episode',
        id: item.Id,
        title: item.Name ?? '',
        seriesId: item.SeriesId ?? '',
        seriesTitle: item.SeriesName ?? '',
        seasonId: item.SeasonId ?? null,
        seasonNumber: item.ParentIndexNumber ?? null,
        episodeNumber: item.IndexNumber ?? null,
        runtimeMs: ticksToMs(item.RunTimeTicks),
        overview: item.Overview ?? null,
        resumePositionMs: ticksToMs(item.UserData?.PlaybackPositionTicks) ?? 0,
        isPlayed: item.UserData?.Played ?? false,
        lastPlayedAt: date(item.UserData?.LastPlayedDate),
        addedAt: date(item.DateCreated),
        artwork: { poster: null, landscape, backdrop: parentBackdrops[0] ?? null, logo, backdrops: parentBackdrops },
        stillUrl: ownImage(server, item, 'Primary', imageWidths.landscape),
        touchedAt: null,
    }
}
