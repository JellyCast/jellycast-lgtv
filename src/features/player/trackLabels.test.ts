import { describe, expect, it } from 'vitest'
import type { MediaStream } from '../../core/playback/playbackInfo'
import { subtitleEntries, trackLabel } from './trackLabels'

const release = 'Game.of.Thrones.S08E06.2160p.BluRay.REMUX.HEVC.TrueHD.7.1.Atmos-FGT'

function audio(index: number, title?: string): MediaStream {
    return { Type: 'Audio', Index: index, Title: title }
}

describe('trackLabel', () => {
    it('ignores a release name that every track carries', () => {
        const tracks = [audio(1, release), audio(2, release)]

        expect(trackLabel(tracks[0], tracks, 'English', 'Track 1')).toEqual({ label: 'English', title: null })
    })

    it('keeps a short title that tells the track apart', () => {
        const tracks = [audio(1, 'Surround 5.1'), audio(2, 'Commentary')]

        expect(trackLabel(tracks[1], tracks, 'English', 'Track 2')).toEqual({ label: 'English', title: 'Commentary' })
    })

    it('falls back to the title, then to the track number, without a language', () => {
        const tracks = [audio(1, 'Commentary'), audio(2)]

        expect(trackLabel(tracks[0], tracks, null, 'Track 1').label).toBe('Commentary')
        expect(trackLabel(tracks[1], tracks, null, 'Track 2').label).toBe('Track 2')
    })
})

function subtitle(index: number, language: string | undefined, extra: Partial<MediaStream> = {}): MediaStream {
    return { Type: 'Subtitle', Index: index, Language: language, Codec: 'subrip', ...extra }
}

const dutchNames = (code: string) =>
    ['nl', 'en', code].map((locale) => {
        const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
        return name.charAt(0).toUpperCase() + name.slice(1)
    })

const entries = (streams: MediaStream[], preferred: string[] = []) => subtitleEntries(streams, preferred, dutchNames, 'nl')

describe('subtitleEntries', () => {
    it('puts the preferred languages first and the rest alphabetically in the app language', () => {
        const streams = ['eng', 'ara', 'deu', 'nld', 'fra', 'spa'].map((code, index) => subtitle(index, code))
        streams.push(subtitle(9, 'eng', { Title: 'SDH', IsHearingImpaired: true }))

        const result = entries(streams, ['nld', 'eng'])

        expect(result.map((entry) => entry.language)).toEqual(['Nederlands', 'Engels', 'Engels', 'Arabisch', 'Duits', 'Frans', 'Spaans'])
        expect(result[2]).toMatchObject({ isSdh: true, title: null })
    })

    it('drops a title that only repeats the language, flags or format', () => {
        const titles = ['English', 'English [Forced]', 'Engels', 'Full SRT', 'English (SDH)']
        const result = entries(titles.map((title, index) => subtitle(index, 'eng', { Title: title })))

        expect(result.every((entry) => entry.title === null)).toBe(true)
        expect(result.find((entry) => entry.stream.Title === 'English [Forced]')?.isForced).toBe(true)
    })

    it('keeps a title that adds something', () => {
        const result = entries([subtitle(1, 'zho', { Title: 'Simplified' }), subtitle(2, 'zho', { Title: 'Traditional' })])

        expect(result.map((entry) => [entry.title, entry.number])).toEqual([
            ['Simplified', null],
            ['Traditional', null],
        ])
    })

    it('numbers streams that would look the same', () => {
        expect(entries([subtitle(1, 'spa'), subtitle(2, 'spa')]).map((entry) => entry.number)).toEqual([null, 2])
    })

    it('puts plain before SDH and forced last within a language', () => {
        const result = entries([subtitle(1, 'eng', { IsForced: true }), subtitle(2, 'eng', { IsHearingImpaired: true }), subtitle(3, 'eng')])

        expect(result.map((entry) => entry.stream.Index)).toEqual([3, 2, 1])
    })

    it('marks image subtitles and puts streams without a language last', () => {
        const result = entries([subtitle(1, undefined, { Title: 'Commentary' }), subtitle(2, 'eng', { Codec: 'PGSSUB' })])

        expect(result[0].isImage).toBe(true)
        expect(result[1].title).toBe('Commentary')
    })
})
