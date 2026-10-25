import type { JellyfinClient } from '../api/client'
import type { Session } from '../api/session'

interface ProviderItem {
    SeriesId?: string
    ProviderIds?: Record<string, string>
}

interface SparqlAnswer {
    results?: { bindings?: { code?: { value?: string } }[] }
}

const sparqlUrl = 'https://query.wikidata.org/sparql'
// Playback waits for this; without an answer the fallback languages decide.
const timeoutMs = 2500
// Per IMDb id; episodes share their series' entry.
const cache = new Map<string, string[]>()

/**
 * Jellyfin keeps no original language; Wikidata knows it by IMDb id, without an API key.
 * ISO 639-1 codes ("en"); empty when unknown or unreachable.
 */
export async function originalLanguages(client: JellyfinClient, session: Session, itemId: string): Promise<string[]> {
    try {
        const imdbId = await imdbIdOf(client, session, itemId)
        if (!imdbId) return []
        const cached = cache.get(imdbId)
        if (cached) return cached
        const languages = await queryWikidata(imdbId)
        console.info(`[audio] original language of ${imdbId}: ${languages.join(', ')}`)
        cache.set(imdbId, languages)
        return languages
    } catch (error) {
        console.info(`[audio] no original language for ${itemId}`, error)
        return []
    }
}

// Episode IMDb ids rarely carry a language on Wikidata, so episodes use their series.
async function imdbIdOf(client: JellyfinClient, session: Session, itemId: string): Promise<string | undefined> {
    const item = await providerItem(client, session, itemId)
    const title = item.SeriesId ? await providerItem(client, session, item.SeriesId) : item
    const imdbId = title.ProviderIds?.Imdb
    return imdbId?.startsWith('tt') ? imdbId : undefined
}

function providerItem(client: JellyfinClient, session: Session, itemId: string): Promise<ProviderItem> {
    return client.get<ProviderItem>(`/Users/${session.userId}/Items/${itemId}?fields=ProviderIds`)
}

async function queryWikidata(imdbId: string): Promise<string[]> {
    const query = `SELECT ?code WHERE { ?work wdt:P345 "${imdbId}"; wdt:P364 ?language. ?language wdt:P218 ?code }`
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(`${sparqlUrl}?format=json&query=${encodeURIComponent(query)}`, {
            signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Wikidata: ${response.status}`)
        return languageCodes((await response.json()) as SparqlAnswer)
    } finally {
        window.clearTimeout(timer)
    }
}

export function languageCodes(answer: SparqlAnswer): string[] {
    const codes = (answer.results?.bindings ?? []).map((binding) => binding.code?.value).filter(Boolean) as string[]
    return [...new Set(codes)]
}
