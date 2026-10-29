import { useEffect, useState } from 'preact/hooks'
import { fetchPlacements, parsePlacements, sendPing, type AdPlacements } from './jellyCastService'

export type UsageChoice = 'allowed' | 'declined'

/** Raise when what is sent or why changes, so everyone is asked again. Same as iOS and Android. */
export const usageConsentVersion = 2

const choiceKey = 'jellycast.usage.choice'
const versionKey = 'jellycast.usage.consentVersion'
const decidedAtKey = 'jellycast.usage.decidedAt'
const installIdKey = 'jellycast.usage.installId'
const placementsKey = 'jellycast.ads.placements'
const pingIntervalMs = 60 * 60 * 1000
const refreshIntervalMs = 15 * 60 * 1000

function read(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function write(key: string, value: string | null): void {
    try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
    } catch {
        // The choice then lasts until the app closes, and is asked again next time.
    }
}

/** `null` while the current version of the question is unanswered. */
export function usageChoice(): UsageChoice | null {
    if (read(versionKey) !== String(usageConsentVersion)) return null
    const choice = read(choiceKey)
    return choice === 'allowed' || choice === 'declined' ? choice : null
}

const listeners = new Set<(choice: UsageChoice | null) => void>()

export function useUsageChoice(): UsageChoice | null {
    const [choice, setChoice] = useState(usageChoice)
    useEffect(() => {
        listeners.add(setChoice)
        return () => void listeners.delete(setChoice)
    }, [])
    return choice
}

/** Declining deletes the install ID, so nothing can be sent until it is allowed again. */
export function chooseUsage(choice: UsageChoice): void {
    write(choiceKey, choice)
    write(versionKey, String(usageConsentVersion))
    write(decidedAtKey, new Date().toISOString())
    if (choice === 'allowed') {
        if (!read(installIdKey)) write(installIdKey, randomUuid())
    } else {
        write(installIdKey, null)
        lastPingAt = null
    }
    for (const listener of listeners) listener(choice)
    if (choice === 'allowed') void appOpened()
}

// randomUUID needs a secure context; file:// is one, the dev server over the LAN is not.
function randomUuid(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let lastPingAt: number | null = null
let refreshedAt: number | null = null

/** At launch and when the app comes back; at most one ping an hour, placements every 15 minutes. */
export async function appOpened(now = Date.now()): Promise<void> {
    await Promise.all([ping(now), refreshPlacements(now)])
}

async function ping(now: number): Promise<void> {
    const installId = read(installIdKey)
    if (usageChoice() !== 'allowed' || !installId) return
    if (lastPingAt !== null && now - lastPingAt < pingIntervalMs) return
    lastPingAt = now
    try {
        await sendPing(installId)
    } catch {
        lastPingAt = null
    }
}

async function refreshPlacements(now: number): Promise<void> {
    if (refreshedAt !== null && now - refreshedAt < refreshIntervalMs) return
    refreshedAt = now
    try {
        const text = await fetchPlacements()
        if (parsePlacements(text)) write(placementsKey, text)
    } catch {
        refreshedAt = null
    }
}

/** The last placements, kept between launches; a campaign that has ended is left out. */
export function cachedPlacements(now = Date.now()): AdPlacements | null {
    const text = read(placementsKey)
    const placements = text ? parsePlacements(text) : null
    if (!placements) return null
    return { ...placements, home: placements.home && placements.home.untilMs > now ? placements.home : null }
}
