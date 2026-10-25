import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n/i18n'
import { day, episode, movie, series } from '../../testing/builders'
import { movieShelves, seriesShelves } from './shelves'

describe('movieShelves', () => {
    it('builds continue watching, new and genres with at least three titles', () => {
        setLanguage('en')
        const movies = [
            movie('a', { genres: ['Drama'], resumePositionMs: 10, lastPlayedAt: 5 }),
            movie('b', { genres: ['Drama'], isPlayed: true }),
            movie('c', { genres: ['Drama', 'Comedy'], addedAt: 10 }),
        ]

        const shelves = movieShelves(movies)

        expect(shelves.map((shelf) => shelf.key)).toEqual(['continue', 'new', 'genre-Drama'])
        expect(shelves[1].items.map((item) => item.id)).toEqual(['c', 'a'])
    })

    it('translates and sorts genres in the UI language', () => {
        setLanguage('nl')
        const movies = ['a', 'b', 'c'].map((id) => movie(id, { genres: ['War', 'Action'], isPlayed: true }))

        expect(movieShelves(movies).map((shelf) => shelf.key)).toEqual(['genre-Actie', 'genre-Oorlog'])
        setLanguage('en')
    })
})

describe('seriesShelves', () => {
    it('leaves series the user follows out of not started', () => {
        const now = 100 * day
        const followed = series('s1')
        const fresh = series('s2', { lastEpisodeAddedAt: now - day })
        const next = episode('e1', 1, 1, { seriesId: 's1' })

        const shelves = seriesShelves([followed, fresh], [next], now)

        expect(shelves.map((shelf) => shelf.key)).toEqual(['continue', 'new', 'not-started'])
        expect(shelves[2].items.map((item) => item.id)).toEqual(['s2'])
    })
})
