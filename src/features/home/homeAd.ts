import type { AdCampaign, AdPlacements } from '../../core/service/jellyCastService'

/** A campaign from the JellyCast service in the Home stack, chosen by [country] only. */
export interface AdEntry {
    kind: 'ad'
    campaign: AdCampaign
    country: string | null
}

export function isAd(entry: object): entry is AdEntry {
    return (entry as Partial<AdEntry>).kind === 'ad'
}

/** The ad never takes the first suggestion; a shorter stack gets it last. */
export function withAd<T>(stack: T[], placements: AdPlacements | null): (T | AdEntry)[] {
    const campaign = placements?.home
    if (!campaign || stack.length === 0) return stack
    const at = Math.min(Math.max(campaign.position ?? 1, 1), stack.length)
    return [...stack.slice(0, at), { kind: 'ad', campaign, country: placements.country }, ...stack.slice(at)]
}
