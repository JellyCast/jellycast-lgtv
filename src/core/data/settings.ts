import { useEffect, useState } from 'preact/hooks'
import type { Language } from '../i18n/i18n'

export type MovieView = 'detail' | 'bookcase'
export type LibraryKind = 'movies' | 'series'
export type LibrarySort = 'title' | 'added' | 'year' | 'rating'

export interface Settings {
    language: Language
    movieView: MovieView
    maxBitrate: number
    burnInAss: boolean
    libraryKind: LibraryKind
    librarySort: LibrarySort
    subtitleSize: SubtitleSize
    subtitleBackground: boolean
}

export type SubtitleSize = 'small' | 'normal' | 'large'

export const noBitrateLimit = 200_000_000
export const bitrateSteps = [noBitrateLimit, 80_000_000, 40_000_000, 20_000_000, 10_000_000]

const storageKey = 'jellycast.settings'
const defaults: Settings = {
    language: 'en',
    movieView: 'detail',
    maxBitrate: noBitrateLimit,
    burnInAss: false,
    libraryKind: 'movies',
    librarySort: 'title',
    subtitleSize: 'normal',
    subtitleBackground: false,
}

function load(): Settings {
    try {
        const raw = localStorage.getItem(storageKey)
        return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults
    } catch {
        return defaults
    }
}

let current = load()
const listeners = new Set<(settings: Settings) => void>()

export function getSettings(): Settings {
    return current
}

export function updateSettings(change: Partial<Settings>): void {
    current = { ...current, ...change }
    try {
        localStorage.setItem(storageKey, JSON.stringify(current))
    } catch {
        // Settings then last until the app closes.
    }
    for (const listener of listeners) listener(current)
}

export function useSettings(): Settings {
    const [settings, setSettings] = useState(current)
    useEffect(() => {
        listeners.add(setSettings)
        return () => {
            listeners.delete(setSettings)
        }
    }, [])
    return settings
}

export function nextBitrate(bitrate: number): number {
    const index = bitrateSteps.indexOf(bitrate)
    return index < 0 ? noBitrateLimit : bitrateSteps[(index + 1) % bitrateSteps.length]
}
