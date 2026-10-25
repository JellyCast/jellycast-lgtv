import type { MediaStream } from './playbackInfo'

/** Tried after the title's original language: dubbed releases often mark their dub as default. */
export const fallbackAudioLanguages = ['eng', 'nld']

// Track tags mix ISO 639-2/B ("fre") and /T ("fra"); Wikidata gives ISO 639-1 ("fr").
const bibliographicCodes: Record<string, string> = {
    alb: 'sqi', arm: 'hye', baq: 'eus', bur: 'mya', chi: 'zho', cze: 'ces', dut: 'nld', fre: 'fra',
    geo: 'kat', ger: 'deu', gre: 'ell', ice: 'isl', mac: 'mkd', may: 'msa', per: 'fas', rum: 'ron',
    slo: 'slk', tib: 'bod', wel: 'cym',
}

const twoLetterCodes: Record<string, string> = {
    ar: 'ara', cs: 'ces', da: 'dan', de: 'deu', el: 'ell', en: 'eng', es: 'spa', fa: 'fas', fi: 'fin',
    fr: 'fra', he: 'heb', hi: 'hin', hu: 'hun', is: 'isl', it: 'ita', ja: 'jpn', ko: 'kor', nl: 'nld',
    no: 'nor', pl: 'pol', pt: 'por', ru: 'rus', sv: 'swe', th: 'tha', tr: 'tur', uk: 'ukr', zh: 'zho',
}

export function normalizeLanguage(code: string | undefined): string | null {
    const lower = code?.trim().toLowerCase()
    if (!lower || lower === 'und') return null
    return bibliographicCodes[lower] ?? twoLetterCodes[lower] ?? lower
}

export function isCommentary(stream: MediaStream): boolean {
    return /comment/i.test(`${stream.Title ?? ''} ${stream.DisplayTitle ?? ''}`)
}

/** The default track when it is in that language, else the first; never commentary. */
export function mainTrackIn(audio: MediaStream[], language: string | undefined): MediaStream | undefined {
    const wanted = normalizeLanguage(language)
    if (!wanted) return undefined
    const candidates = audio.filter((stream) => normalizeLanguage(stream.Language) === wanted && !isCommentary(stream))
    return candidates.find((stream) => stream.IsDefault) ?? candidates[0]
}

export function preferredTrack(audio: MediaStream[], languages: string[]): MediaStream | undefined {
    for (const language of languages) {
        const track = mainTrackIn(audio, language)
        if (track) return track
    }
    return undefined
}
