import type { MediaSegment } from '../data/library'

const skipEndMarginMs = 1000
const fallbackCreditsMs = 30_000

/** The segment to offer a skip for: any but the credits, until a second before its end. */
export function skippableAt(segments: MediaSegment[], positionMs: number): MediaSegment | null {
    return segments.find((segment) => segment.type !== 'Outro' && positionMs >= segment.startMs && positionMs < segment.endMs - skipEndMarginMs) ?? null
}

/**
 * Where the credits start: the first outro in the second half (an earlier one is a detection error),
 * otherwise the last 30 seconds.
 */
export function nextCardStartMs(segments: MediaSegment[], durationMs: number): number {
    const outro = segments.find((segment) => segment.type === 'Outro' && segment.startMs >= durationMs / 2 && segment.startMs < durationMs)
    return outro ? outro.startMs : durationMs - fallbackCreditsMs
}

/** Stopped in the credits counts as watched. */
export function isFinishedAt(segments: MediaSegment[], durationMs: number, positionMs: number): boolean {
    return durationMs > 0 && positionMs >= nextCardStartMs(segments, durationMs)
}
