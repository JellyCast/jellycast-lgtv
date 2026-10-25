import type { JellyfinClient } from '../api/client'
import { ticksPerMs } from '../model/library'
import type { StreamPlan } from './playbackInfo'

export interface PlaybackState {
    positionMs: number
    isPaused: boolean
    audioStreamIndex: number | null
    subtitleStreamIndex: number | null
}

/**
 * Start, progress and stop reports in one ordered queue. After the stop no progress goes out for
 * that plan any more, otherwise the server thinks it still plays. Failures are only logged.
 */
export class PlaybackReporter {
    private queue: Promise<unknown> = Promise.resolve()
    private readonly stopped = new WeakSet<StreamPlan>()

    constructor(private readonly client: JellyfinClient) {}

    private enqueue(work: () => Promise<unknown>): void {
        this.queue = this.queue.then(work).catch((error) => console.warn('[report]', String(error)))
    }

    private body(itemId: string, plan: StreamPlan, state: PlaybackState) {
        return {
            ItemId: itemId,
            MediaSourceId: plan.mediaSource.Id,
            PlaySessionId: plan.playSessionId,
            PositionTicks: Math.round(state.positionMs * ticksPerMs),
            IsPaused: state.isPaused,
            IsMuted: false,
            CanSeek: true,
            AudioStreamIndex: state.audioStreamIndex,
            SubtitleStreamIndex: state.subtitleStreamIndex,
            PlayMethod: plan.method,
            RepeatMode: 'RepeatNone',
            PlaybackOrder: 'Default',
        }
    }

    start(itemId: string, plan: StreamPlan, state: PlaybackState): void {
        this.enqueue(() => this.client.post('/Sessions/Playing', this.body(itemId, plan, state)))
    }

    progress(itemId: string, plan: StreamPlan, state: PlaybackState): void {
        if (this.stopped.has(plan)) return
        this.enqueue(() => this.client.post('/Sessions/Playing/Progress', this.body(itemId, plan, state)))
    }

    /** `finished`: stopped in the credits, which counts as watched (the server only does that above 90%). */
    stop(itemId: string, plan: StreamPlan, positionMs: number, failed: boolean, finished: boolean, userId: string): void {
        if (this.stopped.has(plan)) return
        this.stopped.add(plan)
        this.enqueue(() =>
            this.client.post('/Sessions/Playing/Stopped', {
                ItemId: itemId,
                MediaSourceId: plan.mediaSource.Id,
                PlaySessionId: plan.playSessionId,
                PositionTicks: Math.round(positionMs * ticksPerMs),
                Failed: failed,
            }),
        )
        if (finished && !failed) this.enqueue(() => this.client.post(`/UserPlayedItems/${itemId}?userId=${userId}`))
    }
}
