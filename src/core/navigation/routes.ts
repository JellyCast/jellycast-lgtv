import type { RequestedStreams } from '../playback/remoteControl'
export type Route =
    | { name: 'server' }
    | { name: 'login' }
    | { name: 'home' }
    | { name: 'series'; seriesId: string; focusEpisodeId?: string }
    | { name: 'movie'; movieId: string }
    | { name: 'player'; itemId: string; fromStart?: boolean; startMs?: number; streams?: RequestedStreams }
    | { name: 'settings' }

export interface StackEntry {
    key: number
    route: Route
}
