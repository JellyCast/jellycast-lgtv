import { describe, expect, it } from 'vitest'
import { parsePlacements, type AdPlacements } from '../../core/service/jellyCastService'
import { withAd } from './homeAd'

const stack = ['a', 'b', 'c']

function placementsAt(position: number | null): AdPlacements {
    return {
        country: 'NL',
        home: { id: 1, position, imageUrl: 'https://x/a.jpg', title: null, advertiser: 'Blender', url: null, untilMs: Infinity },
    }
}

describe('withAd', () => {
    it('puts the ad on its place and pushes the rest one on', () => {
        expect(withAd(stack, placementsAt(2)).map((entry) => (typeof entry === 'string' ? entry : 'ad'))).toEqual(['a', 'b', 'ad', 'c'])
    })

    it('never puts the ad first, and puts it last in a short stack', () => {
        expect(withAd(stack, placementsAt(0))[1]).toMatchObject({ kind: 'ad' })
        expect(withAd(stack, placementsAt(9))[3]).toMatchObject({ kind: 'ad' })
    })

    it('changes nothing without a campaign or without suggestions', () => {
        expect(withAd(stack, null)).toEqual(stack)
        expect(withAd(stack, { country: 'NL', home: null })).toEqual(stack)
        expect(withAd([], placementsAt(1))).toEqual([])
    })
})

describe('parsePlacements', () => {
    it('reads a campaign and ignores fields it does not know', () => {
        const placements = parsePlacements(
            '{"version":1,"country":"NL","home":{"id":7,"position":3,"image":"https://x/a.jpg","advertiser":"Blender","until":"2027-06-01T00:00:00Z","extra":1},"splash":null}',
        )
        expect(placements?.home).toMatchObject({ id: 7, position: 3, advertiser: 'Blender', untilMs: Date.parse('2027-06-01T00:00:00Z') })
    })

    it('rejects what is not placements', () => {
        expect(parsePlacements('<html>')).toBeNull()
    })
})
