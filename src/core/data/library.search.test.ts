import { describe, expect, it } from 'vitest'
import { movie } from '../../testing/builders'
import { searchTitles, sortItems } from './library.search'

describe('library search and sort', () => {
    it('ignores case and accents', () => {
        const movies = [movie('a', { title: 'Amélie' }), movie('b', { title: 'Heat' })]

        expect(searchTitles(movies, 'AME').map((item) => item.id)).toEqual(['a'])
    })

    it('sorts by year with missing years last and ties in A–Z order', () => {
        const movies = [movie('a', { year: 2000 }), movie('b', { year: null }), movie('c', { year: 2010 }), movie('d', { year: 2000 })]

        expect(sortItems(movies, 'year').map((item) => item.id)).toEqual(['c', 'a', 'd', 'b'])
    })
})
