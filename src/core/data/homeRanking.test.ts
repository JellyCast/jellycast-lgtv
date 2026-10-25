import { describe, expect, it } from 'vitest'
import { day, episode, movie } from '../../testing/builders'
import { rankHome } from './homeRanking'

const now = 1_000 * day

describe('rankHome', () => {
    it('puts a movie in progress from yesterday first', () => {
        const recent = movie('m1', { resumePositionMs: 60_000, lastPlayedAt: now - day })
        const fresh = movie('m2', { addedAt: now - day })

        const stack = rankHome([], [recent], [fresh], null, now)

        expect(stack.map((candidate) => [candidate.item.id, candidate.reason])).toEqual([
            ['m1', 'ContinueWatching'],
            ['m2', 'RecentlyAdded'],
        ])
    })

    it('labels an episode added after the previous one was watched as new', () => {
        const next = episode('e2', 1, 2, { touchedAt: now - 10 * day, addedAt: now - 2 * day })

        expect(rankHome([next], [], [], null, now)[0].reason).toBe('NewEpisode')
    })

    it('falls back to older continue watching, then a random movie', () => {
        const old = movie('m1', { resumePositionMs: 60_000, lastPlayedAt: now - 90 * day })
        const random = movie('m9')

        const stack = rankHome([], [old], [], random, now)

        expect(stack.map((candidate) => candidate.item.id)).toEqual(['m1', 'm9'])
        expect(stack[1].reason).toBe('ForTonight')
    })

    it('keeps at most five suggestions without duplicates', () => {
        const movies = Array.from({ length: 8 }, (_, index) => movie(`m${index}`, { addedAt: now - day }))

        const stack = rankHome([], [], movies, movies[0], now)

        expect(stack).toHaveLength(5)
        expect(new Set(stack.map((candidate) => candidate.item.id)).size).toBe(5)
    })
})
