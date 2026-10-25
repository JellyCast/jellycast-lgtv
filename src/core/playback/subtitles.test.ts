import { describe, expect, it } from 'vitest'
import { cueAt, parseVtt } from './subtitles'

describe('parseVtt', () => {
    it('reads cues with and without hours and strips tags', () => {
        const cues = parseVtt('WEBVTT\n\n1\n00:00:01.500 --> 00:00:03.000\n<i>Hello</i>\n\n01:00.000 --> 01:02.250 line:90%\nTwo\nlines\n')

        expect(cues).toEqual([
            { startMs: 1500, endMs: 3000, text: 'Hello' },
            { startMs: 60_000, endMs: 62_250, text: 'Two\nlines' },
        ])
        expect(cueAt(cues, 2000)).toBe('Hello')
        expect(cueAt(cues, 5000)).toBeNull()
    })
})
