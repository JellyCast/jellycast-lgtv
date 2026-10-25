import { describe, expect, it } from 'vitest'
import { KeyframeSeek } from './keyframeSeek'

describe('KeyframeSeek', () => {
    it('asks for the target itself until it has seen a seek land', () => {
        expect(new KeyframeSeek().request(60_000)).toBe(60_000)
    })

    it('asks half a keyframe interval further once the interval is known', () => {
        const seek = new KeyframeSeek()

        seek.landed(169_670, 162_990)

        expect(seek.request(200_000)).toBe(203_340)
    })

    it('ignores landings that are on time or implausibly far off', () => {
        const seek = new KeyframeSeek()

        seek.landed(60_000, 59_900)
        seek.landed(60_000, 30_000)

        expect(seek.request(90_000)).toBe(90_000)
    })
})
