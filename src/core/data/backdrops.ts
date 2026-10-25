/**
 * Which of an item's backdrops shows (the server keeps up to five). Random on first sight, stable
 * while shown; leaving a section moves its items to their next backdrop, already while hidden.
 */
const chosen = new Map<string, number>()

export function backdropIndex(ownerId: string, count: number): number {
    if (count <= 1) return 0
    let index = chosen.get(ownerId)
    if (index === undefined || index >= count) {
        index = Math.floor(Math.random() * count)
        chosen.set(ownerId, index)
    }
    return index
}

export function advanceBackdrops(ownerIds: Iterable<string>): void {
    for (const id of ownerIds) {
        const index = chosen.get(id)
        if (index !== undefined) chosen.set(id, index + 1)
    }
}

export function pickBackdrop(ownerId: string, backdrops: string[], fallback: string | null): string | null {
    if (backdrops.length === 0) return fallback
    return backdrops[backdropIndex(ownerId, backdrops.length) % backdrops.length]
}
