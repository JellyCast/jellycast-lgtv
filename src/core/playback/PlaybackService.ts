import { JellyfinClient } from '../api/client'
import type { Session } from '../api/session'
import { currentProfileOptions } from './options'
import { planStream, type PlanOverrides, type StreamPlan } from './playbackInfo'
import { describePlan, type PlaybackTech } from './tech'

/** Stream plans for the player, and the tech line they imply for detail screens. */
export class PlaybackService {
    readonly client: JellyfinClient
    private readonly tech = new Map<string, Promise<PlaybackTech | null>>()

    constructor(readonly session: Session) {
        this.client = new JellyfinClient(session.serverUrl, session.accessToken)
    }

    plan(itemId: string, overrides: PlanOverrides = {}): Promise<StreamPlan> {
        return planStream(this.client, this.session, itemId, currentProfileOptions(), overrides)
    }

    /** Once per item; a failure may be retried. */
    techFor(itemId: string): Promise<PlaybackTech | null> {
        let pending = this.tech.get(itemId)
        if (!pending) {
            pending = this.plan(itemId)
                .then(describePlan)
                .catch(() => {
                    this.tech.delete(itemId)
                    return null
                })
            this.tech.set(itemId, pending)
        }
        return pending
    }
}
