import { t } from '../i18n/i18n'
import { mainTrackIn } from './audioLanguage'
import type { MediaStream, StreamPlan } from './playbackInfo'

/** "truehd" → "TrueHD", "pcm_s24le" → "PCM"; other codecs in upper case. */
export function audioCodecName(codec: string): string {
    const name = codec.toLowerCase()
    if (name === 'truehd') return 'TrueHD'
    if (name.startsWith('pcm')) return 'PCM'
    return codec.toUpperCase()
}

export function audioTrackLabel(stream: MediaStream): string {
    return audioCodecName(stream.Codec ?? '') + (stream.AudioSpatialFormat === 'DolbyAtmos' ? ` ${t('tech_atmos')}` : '')
}

export function sourceRangeLabel(rangeType: string | undefined): string | null {
    if (!rangeType) return null
    if (rangeType.startsWith('DOVI')) return t('tech_dolby_vision')
    if (rangeType === 'HDR10Plus') return t('tech_hdr10_plus')
    if (rangeType === 'HDR10') return t('tech_hdr10')
    if (rangeType === 'HLG') return t('tech_hlg')
    return null
}

export interface PlaybackTech {
    video: string | null
    audio: string | null
    method: string
}

/**
 * What the file has and how it plays here: "DTS-HD MA → AC3 track" when the app chose another track,
 * and what the server does (direct play, audio or video converted).
 */
export function describePlan(plan: StreamPlan): PlaybackTech {
    const streams = plan.mediaSource.MediaStreams
    const video = streams.find((stream) => stream.Type === 'Video')
    const audioStreams = streams.filter((stream) => stream.Type === 'Audio')
    const fileDefault =
        audioStreams.find((stream) => stream.Index === plan.mediaSource.DefaultAudioStreamIndex) ?? audioStreams[0]
    const played = audioStreams.find((stream) => stream.Index === plan.audio?.streamIndex) ?? fileDefault
    let audio: string | null = null
    if (played) {
        // A language choice is no replacement; a codec swap within the language is.
        const source = mainTrackIn(audioStreams, played.Language) ?? played
        audio =
            played.Index !== source.Index
                ? t('tech_audio_replaced', audioTrackLabel(source), audioTrackLabel(played))
                : audioTrackLabel(played)
    }
    const videoConverted = plan.transcodeReasons.some((reason) => reason.startsWith('Video') || reason.includes('Subtitle'))
    const audioConverted = plan.transcodeReasons.some((reason) => reason.startsWith('Audio'))
    const method =
        plan.method === 'DirectPlay'
            ? t('tech_direct_play')
            : videoConverted
              ? t('tech_video_converted')
              : audioConverted
                ? t('tech_audio_converted')
                : t('tech_transcoded')
    return { video: sourceRangeLabel(video?.VideoRangeType), audio, method }
}
