import type { LibrarySort } from './settings'

interface Sortable {
    title: string
    year: number | null
    communityRating: number | null
    addedAt?: number | null
    lastEpisodeAddedAt?: number | null
}

const sortOrder: LibrarySort[] = ['title', 'added', 'year', 'rating']

export function nextSort(sort: LibrarySort): LibrarySort {
    return sortOrder[(sortOrder.indexOf(sort) + 1) % sortOrder.length]
}

/** Lower case without accents, so "Amelie" finds "Amélie". */
export function normalizeTitle(text: string): string {
    return text.normalize('NFD').replace(/\p{Mn}+/gu, '').toLowerCase()
}

export function searchTitles<T extends Sortable>(items: T[], query: string): T[] {
    const needle = normalizeTitle(query.trim())
    return needle ? items.filter((item) => normalizeTitle(item.title).includes(needle)) : items
}

/** A–Z keeps the server's order; the others are newest or highest first, ties staying A–Z. */
export function sortItems<T extends Sortable>(items: T[], sort: LibrarySort): T[] {
    const key = (item: T): number | null => {
        switch (sort) {
            case 'added':
                return item.addedAt ?? item.lastEpisodeAddedAt ?? null
            case 'year':
                return item.year
            case 'rating':
                return item.communityRating ?? -1
            default:
                return 0
        }
    }
    if (sort === 'title') return items
    return items
        .map((item, index) => ({ item, index, value: key(item) }))
        .sort((a, b) => {
            if (a.value === b.value) return a.index - b.index
            if (a.value === null) return 1
            if (b.value === null) return -1
            return b.value - a.value || a.index - b.index
        })
        .map((entry) => entry.item)
}
