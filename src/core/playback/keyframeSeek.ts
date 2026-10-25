const maxSpacingMs = 10_000
const measurableLandingMs = 300

/**
 * The TV's player seeks to the keyframe before the requested position, which in some files is
 * seconds earlier. This learns the keyframe spacing from where seeks land, and asks for a point half
 * a spacing later, so a seek lands on the nearest keyframe instead (like Media3's CLOSEST_SYNC).
 */
export class KeyframeSeek {
    private spacingMs = 0

    /** The position to ask the player for, to land as close as possible to `targetMs`. */
    request(targetMs: number): number {
        return targetMs + this.spacingMs / 2
    }

    /** Where a seek to `requestedMs` actually landed; the gap is at least one keyframe interval. */
    landed(requestedMs: number, landedMs: number): void {
        const gap = requestedMs - landedMs
        if (gap > measurableLandingMs && gap <= maxSpacingMs) this.spacingMs = Math.max(this.spacingMs, gap)
    }
}
