import { describe, expect, it } from 'vitest'
import { episode } from '../../testing/builders'
import { continueEpisode, nextEpisodeAfter } from './library'

describe('continueEpisode', () => {
    it('resumes the most recently touched episode in progress', () => {
        const episodes = [episode('e1', 1, 1, { isPlayed: true, lastPlayedAt: 1 }), episode('e2', 1, 2, { resumePositionMs: 5, lastPlayedAt: 2 })]

        expect(continueEpisode(episodes)?.id).toBe('e2')
    })

    it('continues after a watched episode, also when older episodes are unwatched', () => {
        const episodes = [episode('e1', 1, 1), episode('e2', 1, 2, { isPlayed: true, lastPlayedAt: 3 }), episode('e3', 1, 3)]

        expect(continueEpisode(episodes)?.id).toBe('e3')
    })

    it('takes the latest episode when a season was marked at once', () => {
        const episodes = [1, 2, 3].map((number) => episode(`e${number}`, 1, number, { isPlayed: true, lastPlayedAt: 7 }))
        episodes.push(episode('e4', 1, 4))

        expect(continueEpisode(episodes)?.id).toBe('e4')
    })

    it('skips specials and returns null when nothing is started', () => {
        expect(continueEpisode([episode('s', 0, 1, { isPlayed: true }), episode('e1', 1, 1)])).toBeNull()
    })
})

describe('nextEpisodeAfter', () => {
    it('crosses into the next season', () => {
        const last = episode('e2', 1, 2)
        const episodes = [episode('e3', 2, 1), last, episode('e1', 1, 1)]

        expect(nextEpisodeAfter(episodes, last)?.id).toBe('e3')
    })
})
