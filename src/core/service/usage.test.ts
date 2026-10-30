import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedPlacements } from './usage'

const day = 24 * 60 * 60 * 1000
const receivedAt = Date.parse('2027-01-01T00:00:00Z')
const answer = JSON.stringify({
    version: 1,
    country: 'NL',
    home: { id: 7, position: 3, image: 'https://x/a.jpg', advertiser: 'Blender', until: '2027-06-01T00:00:00Z' },
})

describe('cachedPlacements', () => {
    beforeEach(() => {
        const items = new Map<string, string>([
            ['jellycast.ads.placements', answer],
            ['jellycast.ads.placementsReceivedAt', String(receivedAt)],
        ])
        vi.stubGlobal('localStorage', { getItem: (key: string) => items.get(key) ?? null })
    })

    afterEach(() => vi.unstubAllGlobals())

    it('keeps a running campaign for a day after the last answer', () => {
        expect(cachedPlacements(receivedAt + day - 1)?.home?.id).toBe(7)
    })

    it('stops showing it after a day without an answer from the service', () => {
        expect(cachedPlacements(receivedAt + day)?.home).toBeNull()
    })
})
