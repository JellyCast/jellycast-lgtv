import { fallbackAudioLanguages, isCommentary, normalizeLanguage, preferredTrack } from './audioLanguage'
import type { ProfileOptions } from './deviceProfile'
import type { MediaStream } from './playbackInfo'

export interface AudioChoice {
    streamIndex: number
    /** False when the server has to convert the chosen track. */
    decodable: boolean
    /** Position in `video.audioTracks`, which lists only the tracks the TV can decode, in file order. */
    tvTrackPosition: number | null
}

const baseDecodableCodecs = ['aac', 'ac3', 'eac3', 'mp3', 'flac', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le']
const surroundChannels = 6

export function decodableAudioCodecs(options: ProfileOptions): string[] {
    const codecs = [...baseDecodableCodecs]
    if (options.dts) codecs.push('dts', 'dca')
    if (options.trueHd) codecs.push('truehd')
    return codecs
}

/**
 * Starts from the main track in the first of `languages` the file has, else the default track.
 * Then prefers a decodable Atmos track in that language, then that track when the TV decodes it,
 * then a decodable track in the same language that keeps surround. Commentary is never chosen.
 * Falls back to the starting track, which the server converts.
 */
export function chooseAudioStream(
    streams: MediaStream[],
    defaultIndex: number | undefined,
    decodableCodecs: string[],
    languages: string[] = fallbackAudioLanguages,
): AudioChoice | null {
    const audio = streams.filter((stream) => stream.Type === 'Audio')
    if (audio.length === 0) return null
    const isDecodable = (stream: MediaStream) => decodableCodecs.includes(stream.Codec ?? '')
    const fileDefault = audio.find((stream) => stream.Index === defaultIndex) ?? audio[0]
    const base = preferredTrack(audio, languages) ?? fileDefault

    const minimumChannels = Math.min(base.Channels ?? 2, surroundChannels)
    const alternatives = audio
        .filter((stream) => isDecodable(stream))
        .filter((stream) => normalizeLanguage(stream.Language) === normalizeLanguage(base.Language) && !isCommentary(stream))
        .filter((stream) => (stream.Channels ?? 0) >= minimumChannels)
        .sort((a, b) => (b.Channels ?? 0) - (a.Channels ?? 0) || a.Index - b.Index)
    const atmos = alternatives.find(isAtmos)

    const chosen = atmos ?? (isDecodable(base) ? base : alternatives[0] ?? base)
    if (!isDecodable(chosen)) return { streamIndex: chosen.Index, decodable: false, tvTrackPosition: null }
    const position = audio.filter((stream) => isDecodable(stream) && stream.Index < chosen.Index).length
    return { streamIndex: chosen.Index, decodable: true, tvTrackPosition: position }
}

function isAtmos(stream: MediaStream): boolean {
    return /atmos/i.test(`${stream.Profile ?? ''} ${stream.Title ?? ''} ${stream.DisplayTitle ?? ''}`)
}

/** The choice for a track the user picked in the audio menu. */
export function audioChoiceFor(streams: MediaStream[], streamIndex: number, decodableCodecs: string[]): AudioChoice {
    const audio = streams.filter((stream) => stream.Type === 'Audio')
    const isDecodable = (stream: MediaStream) => decodableCodecs.includes(stream.Codec ?? '')
    const chosen = audio.find((stream) => stream.Index === streamIndex)
    if (!chosen || !isDecodable(chosen)) return { streamIndex, decodable: false, tvTrackPosition: null }
    const position = audio.filter((stream) => isDecodable(stream) && stream.Index < chosen.Index).length
    return { streamIndex, decodable: true, tvTrackPosition: position }
}
