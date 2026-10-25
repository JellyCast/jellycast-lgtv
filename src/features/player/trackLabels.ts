import { normalizeLanguage } from '../../core/playback/audioLanguage'
import type { MediaStream } from '../../core/playback/playbackInfo'

const maxTitleLength = 40

/**
 * A track title worth showing: short, and not the same on every track. Many remuxes put the release
 * file name on every track, which tells the tracks apart no better than nothing.
 */
export function meaningfulTitle(stream: MediaStream, siblings: MediaStream[], language: string | null): string | null {
    const title = stream.Title?.trim()
    if (!title || title.length > maxTitleLength) return null
    if (siblings.length > 1 && siblings.every((other) => other.Title?.trim() === title)) return null
    if (language && title.toLowerCase() === language.toLowerCase()) return null
    return title
}

/** The language first, then a meaningful title, then "Track n". */
export function trackLabel(
    stream: MediaStream,
    siblings: MediaStream[],
    language: string | null,
    fallback: string,
): { label: string; title: string | null } {
    const title = meaningfulTitle(stream, siblings, language)
    if (language) return { label: language, title }
    return { label: title ?? fallback, title: null }
}

/** A subtitle stream as the menu shows it: the language, and what tells it apart from the others. */
export interface SubtitleEntry {
    stream: MediaStream
    language: string | null
    /** A name from the file that adds something to the language, e.g. "Simplified". */
    title: string | null
    isSdh: boolean
    isForced: boolean
    /** Drawn as images (PGS, VobSub): the size and background settings do not apply. */
    isImage: boolean
    /** 2, 3, … for streams that would otherwise look the same. */
    number: number | null
}

const sdhWords = ['sdh', 'cc', 'hearing impaired']
const noiseWords = [...sdhWords, 'forced', 'full', 'default', 'subtitles', 'subtitle', 'subs', 'srt', 'subrip', 'ass', 'ssa', 'pgs', 'vobsub']
const imageCodecs = /pgs|dvd|dvb|vobsub/i

function wordPattern(word: string): RegExp {
    return new RegExp(`(?<!\\p{L})${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'giu')
}

function onlyRepeats(title: string, names: string[]): boolean {
    let rest = title.toLowerCase()
    for (const word of [...names.map((name) => name.toLowerCase()), ...noiseWords].sort((a, b) => b.length - a.length)) {
        rest = rest.replace(wordPattern(word), ' ')
    }
    return !/[\p{L}\p{N}]/u.test(rest)
}

/**
 * The preferred languages first, in that order, then the rest alphabetically by name. Within a
 * language the plain stream comes before SDH, and forced comes last.
 */
export function subtitleEntries(
    streams: MediaStream[],
    preferred: string[],
    languageNames: (code: string) => string[],
    locale: string,
): SubtitleEntry[] {
    const preferredCodes = preferred.map(normalizeLanguage)
    const titles = streams.map((stream) => stream.Title?.trim())
    const shared = streams.length > 1 && titles.every((title) => title === titles[0]) ? titles[0] : undefined
    const collator = new Intl.Collator(locale)

    const ranked = streams.map((stream, position) => {
        const code = normalizeLanguage(stream.Language)
        const names = code ? languageNames(code) : []
        const raw = stream.Title?.trim()
        const title = raw && raw !== shared ? raw : null
        const keywords = title?.toLowerCase() ?? ''
        const entry: SubtitleEntry = {
            stream,
            language: names[0] ?? null,
            title: title && title.length <= maxTitleLength && !onlyRepeats(title, names) ? title : null,
            isSdh: !!stream.IsHearingImpaired || sdhWords.some((word) => wordPattern(word).test(keywords)),
            isForced: !!stream.IsForced || wordPattern('forced').test(keywords),
            isImage: imageCodecs.test(stream.Codec ?? ''),
            number: null,
        }
        const preference = code ? preferredCodes.indexOf(code) : -1
        return { entry, rank: preference >= 0 ? preference : preferredCodes.length, position }
    })

    const variant = (entry: SubtitleEntry) => (entry.isForced ? 2 : entry.isSdh ? 1 : 0)
    ranked.sort(
        (a, b) =>
            a.rank - b.rank ||
            Number(a.entry.language === null) - Number(b.entry.language === null) ||
            collator.compare(a.entry.language ?? a.entry.title ?? '', b.entry.language ?? b.entry.title ?? '') ||
            variant(a.entry) - variant(b.entry) ||
            a.position - b.position,
    )

    const seen = new Map<string, number>()
    return ranked.map(({ entry }) => {
        const key = JSON.stringify([entry.language, entry.title, entry.isSdh, entry.isForced, entry.isImage])
        const count = (seen.get(key) ?? 0) + 1
        seen.set(key, count)
        return { ...entry, number: count > 1 ? count : null }
    })
}
