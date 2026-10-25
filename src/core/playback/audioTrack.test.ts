import { describe, expect, it } from 'vitest'
import { chooseAudioStream, decodableAudioCodecs } from './audioTrack'
import { defaultProfileOptions } from './deviceProfile'
import type { MediaStream } from './playbackInfo'

const codecs = decodableAudioCodecs(defaultProfileOptions)

function audio(index: number, codec: string, language: string, channels: number, title = '', profile = ''): MediaStream {
    return { Type: 'Audio', Index: index, Codec: codec, Language: language, Channels: channels, Title: title, Profile: profile }
}

const atmosProfile = 'Dolby Digital Plus + Dolby Atmos'

describe('chooseAudioStream', () => {
    it('keeps a decodable default track', () => {
        const streams = [audio(1, 'ac3', 'eng', 2), audio(2, 'eac3', 'eng', 6)]

        expect(chooseAudioStream(streams, 1, codecs)).toEqual({ streamIndex: 1, decodable: true, tvTrackPosition: 0 })
    })

    it('prefers a decodable Atmos track over a decodable default track', () => {
        const streams = [audio(1, 'eac3', 'eng', 6, '', atmosProfile), audio(2, 'eac3', 'eng', 6)]

        expect(chooseAudioStream(streams, 2, codecs)).toEqual({ streamIndex: 1, decodable: true, tvTrackPosition: 0 })
    })

    it('ignores Atmos in another language', () => {
        const streams = [audio(1, 'eac3', 'spa', 6, '', atmosProfile), audio(2, 'ac3', 'eng', 6)]

        expect(chooseAudioStream(streams, 2, codecs)?.streamIndex).toBe(2)
    })

    it('replaces TrueHD by a same-language track instead of the first decodable one', () => {
        const streams = [
            audio(1, 'truehd', 'eng', 8),
            audio(2, 'dts', 'eng', 6),
            audio(3, 'ac3', 'spa', 6),
            audio(4, 'ac3', 'eng', 6),
        ]

        expect(chooseAudioStream(streams, 1, codecs)).toEqual({ streamIndex: 4, decodable: true, tvTrackPosition: 1 })
    })

    it('lets the server convert the default track when no decodable track shares its language', () => {
        const streams = [audio(1, 'truehd', 'eng', 8), audio(2, 'ac3', 'spa', 6)]

        expect(chooseAudioStream(streams, 1, codecs)).toEqual({ streamIndex: 1, decodable: false, tvTrackPosition: null })
    })

    it('skips commentary and stereo tracks that would drop surround', () => {
        const streams = [
            audio(1, 'dts', 'eng', 6),
            audio(2, 'ac3', 'eng', 6, 'Director commentary'),
            audio(3, 'flac', 'eng', 2),
        ]

        expect(chooseAudioStream(streams, 1, codecs)?.decodable).toBe(false)
    })

    it('prefers the track with the most channels', () => {
        const streams = [audio(1, 'truehd', 'eng', 8), audio(2, 'ac3', 'eng', 6), audio(3, 'eac3', 'eng', 8)]

        expect(chooseAudioStream(streams, 1, codecs)?.streamIndex).toBe(3)
    })

    it('returns null without audio', () => {
        expect(chooseAudioStream([{ Type: 'Video', Index: 0 }], undefined, codecs)).toBeNull()
    })
})

describe('chooseAudioStream by language', () => {
    const dubbed = [{ ...audio(1, 'ac3', 'ita', 6, 'Italian'), IsDefault: true }, audio(2, 'eac3', 'eng', 6, 'English')]

    it('plays the original language instead of a dubbed default track', () => {
        expect(chooseAudioStream(dubbed, 1, codecs, ['en', 'eng', 'nld'])?.streamIndex).toBe(2)
    })

    it('falls back to English when the original language is unknown', () => {
        expect(chooseAudioStream(dubbed, 1, codecs)?.streamIndex).toBe(2)
    })

    it('plays a French original in French next to an English dub', () => {
        const streams = [{ ...audio(1, 'eac3', 'eng', 6), IsDefault: true }, audio(2, 'ac3', 'fre', 6)]

        expect(chooseAudioStream(streams, 1, codecs, ['fr', 'eng', 'nld'])?.streamIndex).toBe(2)
    })

    it('takes Dutch when there is no English', () => {
        const streams = [{ ...audio(1, 'ac3', 'spa', 6), IsDefault: true }, audio(2, 'ac3', 'dut', 6)]

        expect(chooseAudioStream(streams, 1, codecs)?.streamIndex).toBe(2)
    })

    it('keeps the default track without a preferred language', () => {
        const streams = [{ ...audio(1, 'ac3', 'fra', 6), IsDefault: true }, audio(2, 'ac3', 'deu', 6)]

        expect(chooseAudioStream(streams, 1, codecs)?.streamIndex).toBe(1)
    })

    it('never picks a commentary track for its language', () => {
        const streams = [
            { ...audio(1, 'ac3', 'ita', 6), IsDefault: true },
            audio(2, 'ac3', 'eng', 2, 'Commentary'),
            audio(3, 'eac3', 'eng', 6),
        ]

        expect(chooseAudioStream(streams, 1, codecs)?.streamIndex).toBe(3)
    })
})
