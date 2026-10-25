import { describe, expect, it } from 'vitest'
import { isFinishedAt, nextCardStartMs, skippableAt } from './segments'

const intro = { type: 'Intro' as const, startMs: 10_000, endMs: 60_000 }
const outro = { type: 'Outro' as const, startMs: 2_500_000, endMs: 2_600_000 }

describe('segments', () => {
    it('offers a skip during the intro until a second before its end', () => {
        expect(skippableAt([intro], 30_000)).toBe(intro)
        expect(skippableAt([intro], 59_500)).toBeNull()
    })

    it('starts the next-episode card at the outro, or 30 s before the end', () => {
        expect(nextCardStartMs([outro], 2_600_000)).toBe(2_500_000)
        expect(nextCardStartMs([], 2_600_000)).toBe(2_570_000)
    })

    it('ignores an outro in the first half', () => {
        const early = { type: 'Outro' as const, startMs: 100_000, endMs: 200_000 }

        expect(nextCardStartMs([early], 2_600_000)).toBe(2_570_000)
    })

    it('counts stopping in the credits as watched', () => {
        expect(isFinishedAt([outro], 2_600_000, 2_550_000)).toBe(true)
        expect(isFinishedAt([outro], 2_600_000, 2_000_000)).toBe(false)
    })
})
