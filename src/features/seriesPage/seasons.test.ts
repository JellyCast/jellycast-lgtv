import { describe, expect, it } from 'vitest'
import { episode } from '../../testing/builders'
import { continueOrFirst, groupSeasons } from './seasons'

describe('series page', () => {
    it('orders seasons with specials last', () => {
        const seasons = groupSeasons([episode('s', 0, 1), episode('b', 2, 1), episode('a', 1, 2), episode('c', 1, 1)])

        expect(seasons.map((season) => season.number)).toEqual([1, 2, 0])
        expect(seasons[0].episodes.map((item) => item.id)).toEqual(['c', 'a'])
    })

    it('starts at the first episode when nothing is watched', () => {
        expect(continueOrFirst([episode('e2', 1, 2), episode('e1', 1, 1)])?.id).toBe('e1')
    })
})
