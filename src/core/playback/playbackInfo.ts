import type { JellyfinClient } from '../api/client'
import type { Session } from '../api/session'
import { deviceId } from '../api/session'
import { fallbackAudioLanguages } from './audioLanguage'
import { audioChoiceFor, chooseAudioStream, decodableAudioCodecs, type AudioChoice } from './audioTrack'
import { buildDeviceProfile, type ProfileOptions } from './deviceProfile'
import { originalLanguages } from './originalLanguage'

export interface MediaStream {
    Type: 'Video' | 'Audio' | 'Subtitle' | string
    Index: number
    Codec?: string
    Profile?: string
    Language?: string
    Title?: string
    DisplayTitle?: string
    Channels?: number
    Width?: number
    Height?: number
    VideoRangeType?: string
    AudioSpatialFormat?: string
    IsDefault?: boolean
    IsForced?: boolean
    IsHearingImpaired?: boolean
}

export interface MediaSource {
    Id: string
    Container?: string
    Bitrate?: number
    SupportsDirectPlay: boolean
    SupportsDirectStream: boolean
    SupportsTranscoding: boolean
    TranscodingUrl?: string
    DefaultAudioStreamIndex?: number
    MediaStreams: MediaStream[]
}

interface PlaybackInfoResponse {
    MediaSources: MediaSource[]
    PlaySessionId: string
    ErrorCode?: string
}

const noSubtitles = -1

export type PlayMethod = 'DirectPlay' | 'Transcode'

export interface StreamPlan {
    method: PlayMethod
    url: string
    playSessionId: string
    mediaSource: MediaSource
    transcodeReasons: string[]
    audio: AudioChoice | null
}

export interface PlanOverrides {
    /** A track the user picked; otherwise the app's own choice. */
    audioStreamIndex?: number
    /** Only for subtitles the server must burn in (image formats, or ASS with the setting on). */
    burnInSubtitleIndex?: number
}

export async function planStream(
    client: JellyfinClient,
    session: Session,
    itemId: string,
    options: ProfileOptions,
    overrides: PlanOverrides = {},
): Promise<StreamPlan> {
    const [item, originals] = await Promise.all([
        client.get<{ MediaSources?: MediaSource[] }>(`/Users/${session.userId}/Items/${itemId}`),
        overrides.audioStreamIndex === undefined ? originalLanguages(client, session, itemId) : [],
    ])
    const itemSource = item.MediaSources?.[0]
    if (!itemSource) throw new Error('Item: no media source')
    // An item without streams makes the webOS player reload the whole app.
    if (!itemSource.MediaStreams.some((stream) => stream.Type === 'Video')) {
        throw new Error('Item: no video stream')
    }
    const codecs = decodableAudioCodecs(options)
    const audio =
        overrides.audioStreamIndex !== undefined
            ? audioChoiceFor(itemSource.MediaStreams, overrides.audioStreamIndex, codecs)
            : chooseAudioStream(itemSource.MediaStreams, itemSource.DefaultAudioStreamIndex, codecs, [
                  ...originals,
                  ...fallbackAudioLanguages,
              ])
    const subtitleIndex = overrides.burnInSubtitleIndex ?? noSubtitles
    const burnInFormat = itemSource.MediaStreams.find((stream) => stream.Index === overrides.burnInSubtitleIndex)?.Codec

    const response = await client.post<PlaybackInfoResponse>(
        `/Items/${itemId}/PlaybackInfo?userId=${session.userId}`,
        {
            UserId: session.userId,
            MediaSourceId: itemId,
            // Without this the server picks the account's default subtitle and burns it in.
            SubtitleStreamIndex: subtitleIndex,
            AudioStreamIndex: audio?.streamIndex,
            MaxStreamingBitrate: options.maxBitrate,
            EnableDirectPlay: true,
            EnableDirectStream: true,
            EnableTranscoding: true,
            AllowVideoStreamCopy: true,
            AllowAudioStreamCopy: true,
            AutoOpenLiveStream: true,
            DeviceProfile: buildDeviceProfile(options, burnInFormat),
        },
    )
    if (response.ErrorCode) throw new Error(`PlaybackInfo: ${response.ErrorCode}`)
    const source = response.MediaSources[0]
    if (!source) throw new Error('PlaybackInfo: no media source')

    if (source.SupportsDirectPlay) {
        const container = (source.Container ?? 'mkv').split(',')[0]
        const query = new URLSearchParams({
            static: 'true',
            subtitleStreamIndex: String(subtitleIndex),
            ...(audio ? { audioStreamIndex: String(audio.streamIndex) } : {}),
            mediaSourceId: source.Id,
            playSessionId: response.PlaySessionId,
            deviceId: deviceId(),
            api_key: session.accessToken,
        })
        return {
            method: 'DirectPlay',
            url: `${session.serverUrl}/Videos/${itemId}/stream.${container}?${query}`,
            playSessionId: response.PlaySessionId,
            mediaSource: source,
            transcodeReasons: [],
            audio,
        }
    }

    if (!source.TranscodingUrl) throw new Error('PlaybackInfo: neither direct play nor a transcoding URL')
    const url = new URL(`${session.serverUrl}${source.TranscodingUrl}`)
    // master.m3u8 lists the copied HDR stream next to SDR HEVC and SDR H.264 variants with the
    // same bandwidth, and webOS sometimes picks a tone-mapped one. main.m3u8 is the copied stream.
    url.pathname = url.pathname.replace(/\/master\.m3u8$/, '/main.m3u8')
    if (!url.searchParams.has('api_key') && !url.searchParams.has('ApiKey')) {
        url.searchParams.set('api_key', session.accessToken)
    }
    return {
        method: 'Transcode',
        url: url.toString(),
        playSessionId: response.PlaySessionId,
        mediaSource: source,
        transcodeReasons: (url.searchParams.get('TranscodeReasons') ?? '').split(',').filter(Boolean),
        audio,
    }
}

export async function stopTranscode(client: JellyfinClient, playSessionId: string): Promise<void> {
    const query = new URLSearchParams({ deviceId: deviceId(), playSessionId })
    await client.delete(`/Videos/ActiveEncodings?${query}`)
}

export interface TranscodingInfo {
    IsVideoDirect: boolean
    IsAudioDirect: boolean
    VideoCodec?: string
    AudioCodec?: string
    Container?: string
    Framerate?: number
    HardwareAccelerationType?: string
    TranscodeReasons?: string[]
}

/** What the server is actually doing for this device; null when no transcode job runs. */
export async function activeTranscode(client: JellyfinClient): Promise<TranscodingInfo | null> {
    const sessions = await client.get<{ TranscodingInfo?: TranscodingInfo }[]>(
        `/Sessions?deviceId=${encodeURIComponent(deviceId())}`,
    )
    return sessions.find((session) => session.TranscodingInfo)?.TranscodingInfo ?? null
}

export function redactUrl(url: string): string {
    return url.replace(/(api_key|ApiKey)=[^&]+/g, '$1=…')
}
