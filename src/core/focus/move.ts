/** Moves an index within 0..count-1 without wrap-around; returns null when it cannot move. */
export function step(index: number, delta: number, count: number): number | null {
    const next = index + delta
    return next < 0 || next >= count ? null : next
}
