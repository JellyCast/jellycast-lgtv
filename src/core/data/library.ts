import { authorizationHeader, JellyfinClient } from '../api/client'
import type { ItemDto, ItemsResponse, SegmentDto } from '../api/dto'
import { toEpisode, toMovie, toSeries } from '../api/mappers'
import type { Session } from '../api/session'
import type { Episode, Movie, Playable, Series } from '../model/library'
import { continueEpisode, isStarted, ticksToMs } from '../model/library'

export interface MediaSegment {
    type: 'Intro' | 'Recap' | 'Outro' | 'Commercial' | 'Preview'
    startMs: number
    endMs: number
}

const imageTypes = 'enableImageTypes=Primary,Backdrop,Logo,Thumb&imageTypeLimit=5'
const common = `${imageTypes}&enableUserData=true&enableTotalRecordCount=false`
const movieFields = 'fields=Overview,Genres,DateCreated,MediaStreams'
const seriesFields = 'fields=Overview,Genres,DateLastMediaAdded,ChildCount,RecursiveItemCount'
const nextUpLimit = 20
const recentEpisodeWindow = 300
const episodeCacheSize = 4
const warmUpIntervalMs = 5 * 60_000
const warmUpBytes = 65_535
const segmentTypes = new Set(['Intro', 'Recap', 'Outro', 'Commercial', 'Preview'])

export class LibraryRepository {
    private readonly client: JellyfinClient
    private readonly movies = new Map<string, Movie>()
    private readonly series = new Map<string, Series>()
    private readonly episodes = new Map<string, Episode[]>()
    private readonly warmedAt = new Map<string, number>()

    constructor(private readonly session: Session) {
        this.client = new JellyfinClient(session.serverUrl, session.accessToken)
    }

    private items(query: string): Promise<ItemDto[]> {
        return this.client.get<ItemsResponse>(`/Items?userId=${this.session.userId}&${query}`).then((r) => r.Items)
    }

    private remember<T extends { id: string }>(cache: Map<string, T>, list: T[]): T[] {
        for (const item of list) cache.set(item.id, item)
        return list
    }

    private movie = (item: ItemDto) => toMovie(this.session.serverUrl, item)
    private seriesOf = (item: ItemDto) => toSeries(this.session.serverUrl, item)
    private episode = (item: ItemDto) => toEpisode(this.session.serverUrl, item)

    async getMovies(): Promise<Movie[]> {
        const items = await this.items(`includeItemTypes=Movie&recursive=true&sortBy=SortName&${movieFields}&${common}`)
        return this.remember(this.movies, items.map(this.movie))
    }

    async getSeries(): Promise<Series[]> {
        const items = await this.items(`includeItemTypes=Series&recursive=true&sortBy=SortName&${seriesFields}&${common}`)
        return this.remember(this.series, items.map(this.seriesOf))
    }

    async getResumeMovies(limit: number): Promise<Movie[]> {
        const items = await this.items(
            `includeItemTypes=Movie&recursive=true&filters=IsResumable&sortBy=DatePlayed&sortOrder=Descending&limit=${limit}&${movieFields}&${common}`,
        )
        return this.remember(this.movies, items.map(this.movie))
    }

    async getLatestUnwatchedMovies(limit: number): Promise<Movie[]> {
        const items = await this.items(
            `includeItemTypes=Movie&recursive=true&isPlayed=false&sortBy=DateCreated&sortOrder=Descending&limit=${limit}&${movieFields}&${common}`,
        )
        return this.remember(this.movies, items.map(this.movie))
    }

    async getRandomUnwatchedMovie(): Promise<Movie | null> {
        const items = await this.items(`includeItemTypes=Movie&recursive=true&isPlayed=false&sortBy=Random&limit=1&${movieFields}&${common}`)
        return this.remember(this.movies, items.map(this.movie))[0] ?? null
    }

    async getMovie(id: string): Promise<Movie | null> {
        const items = await this.items(`ids=${id}&${movieFields}&${common}`)
        return this.remember(this.movies, items.map(this.movie))[0] ?? null
    }

    async getSeriesById(id: string): Promise<Series | null> {
        const items = await this.items(`ids=${id}&${seriesFields}&${common}`)
        return this.remember(this.series, items.map(this.seriesOf))[0] ?? null
    }

    peekMovie(id: string): Movie | null {
        return this.movies.get(id) ?? null
    }

    peekSeries(id: string): Series | null {
        return this.series.get(id) ?? null
    }

    peekEpisodes(seriesId: string): Episode[] | null {
        return this.episodes.get(seriesId) ?? null
    }

    async getEpisodes(seriesId: string): Promise<Episode[]> {
        const response = await this.client.get<ItemsResponse>(
            `/Shows/${seriesId}/Episodes?userId=${this.session.userId}&isMissing=false&fields=Overview&enableImageTypes=Primary&imageTypeLimit=1&enableUserData=true`,
        )
        const list = response.Items.map(this.episode)
        this.episodes.delete(seriesId)
        this.episodes.set(seriesId, list)
        while (this.episodes.size > episodeCacheSize) this.episodes.delete(this.episodes.keys().next().value!)
        return list
    }

    async getPlayable(id: string): Promise<Playable | null> {
        const items = await this.items(`ids=${id}&fields=Overview,MediaStreams&${common}`)
        const item = items[0]
        if (!item) return null
        return item.Type === 'Episode' ? this.episode(item) : this.movie(item)
    }

    async getSegments(id: string): Promise<MediaSegment[]> {
        try {
            const response = await this.client.get<{ Items: SegmentDto[] }>(`/MediaSegments/${id}`)
            return response.Items.flatMap((segment) => {
                const startMs = ticksToMs(segment.StartTicks) ?? 0
                const endMs = ticksToMs(segment.EndTicks) ?? 0
                if (!segment.Type || !segmentTypes.has(segment.Type) || endMs <= startMs) return []
                return [{ type: segment.Type as MediaSegment['type'], startMs, endMs }]
            }).sort((a, b) => a.startMs - b.startMs)
        } catch {
            return []
        }
    }

    /** Works for a movie, episode, season or series; updates the cached movie and episode lists. */
    async setPlayed(id: string, played: boolean): Promise<void> {
        const path = `/UserPlayedItems/${id}?userId=${this.session.userId}`
        if (played) await this.client.post(path)
        else await this.client.delete(path)
        const movie = this.movies.get(id)
        if (movie) this.movies.set(id, { ...movie, isPlayed: played, resumePositionMs: 0 })
        for (const [seriesId, list] of this.episodes) {
            this.episodes.set(
                seriesId,
                list.map((episode) =>
                    episode.id === id || episode.seasonId === id || episode.seriesId === id
                        ? { ...episode, isPlayed: played, resumePositionMs: 0 }
                        : episode,
                ),
            )
        }
    }

    /**
     * Continue watching for series, by the user's own last touch: the server's NextUp order does not
     * follow what was watched most recently.
     */
    async getNextUp(): Promise<Episode[]> {
        const recent = await this.lastTouchedEpisodes(null, recentEpisodeWindow)
        const recentSeries = new Set(recent.map((episode) => episode.seriesId))
        const nextUp = await this.client.get<ItemsResponse>(
            `/Shows/NextUp?userId=${this.session.userId}&limit=${nextUpLimit}&enableImages=false&enableUserData=false`,
        )
        const outside = [...new Set(nextUp.Items.map((item) => item.SeriesId).filter((id): id is string => !!id && !recentSeries.has(id)))]
        const extra = await Promise.all(outside.map((seriesId) => this.lastTouchedEpisodes(seriesId, 10).then((list) => list[0])))
        const touched = [...recent, ...extra.filter((episode): episode is Episode => !!episode)]
            .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
            .slice(0, nextUpLimit)
        const picks = await Promise.all(
            touched.map(async (episode) => {
                const pick = episode.isPlayed ? await this.continueAfter(episode) : episode
                return pick ? { id: pick.id, touchedAt: episode.lastPlayedAt } : null
            }),
        )
        const chosen = picks.filter((pick): pick is { id: string; touchedAt: number | null } => pick !== null)
        if (chosen.length === 0) return []
        const details = await this.items(`ids=${chosen.map((pick) => pick.id).join(',')}&fields=Overview,DateCreated&${common}`)
        const byId = new Map(details.map((item) => [item.Id, this.episode(item)]))
        return chosen.flatMap((pick) => {
            const episode = byId.get(pick.id)
            return episode ? [{ ...episode, touchedAt: pick.touchedAt }] : []
        })
    }

    private async lastTouchedEpisodes(seriesId: string | null, limit: number): Promise<Episode[]> {
        const parent = seriesId ? `&parentId=${seriesId}` : ''
        const items = await this.items(
            `includeItemTypes=Episode&recursive=true&sortBy=DatePlayed&sortOrder=Descending&limit=${limit}&enableImages=false&enableUserData=true${parent}`,
        )
        const seen = new Set<string>()
        return items
            .map(this.episode)
            .filter((episode) => isStarted(episode) && (episode.seasonNumber ?? 0) > 0 && episode.seriesId)
            .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
            .filter((episode) => !seen.has(episode.seriesId) && !!seen.add(episode.seriesId))
    }

    private async continueAfter(episode: Episode): Promise<Episode | null> {
        const response = await this.client.get<ItemsResponse>(
            `/Shows/${episode.seriesId}/Episodes?userId=${this.session.userId}&isMissing=false&startItemId=${episode.id}&enableImages=false&enableUserData=true`,
        )
        return continueEpisode(response.Items.map(this.episode))
    }

    /** Reads the first 64 KB so a sleeping server disk spins up while the user is still choosing. */
    warmUp(id: string): void {
        const now = Date.now()
        if (now - (this.warmedAt.get(id) ?? 0) < warmUpIntervalMs) return
        this.warmedAt.set(id, now)
        fetch(`${this.session.serverUrl}/Videos/${id}/stream?static=true`, {
            headers: { Authorization: authorizationHeader(this.session.accessToken), Range: `bytes=0-${warmUpBytes}` },
        })
            .then((response) => response.body?.cancel())
            .catch(() => this.warmedAt.delete(id))
    }
}
