import { useEffect, useState } from 'preact/hooks'

/**
 * Focus within a vertical list of named elements: ↑/↓ move, no wrap-around. When the list changes
 * and the focused element is gone, the focus goes to `fallback` or the first element.
 */
export function useFocusList<T extends string>(ids: T[], initial: T, fallback?: T) {
    const [focused, setFocused] = useState<T>(initial)
    const key = ids.join('|')
    useEffect(() => {
        if (!ids.includes(focused)) setFocused(fallback && ids.includes(fallback) ? fallback : ids[0])
    }, [key])
    const move = (delta: number): boolean => {
        const index = ids.indexOf(focused)
        const next = ids[index + delta]
        if (index < 0 || !next) return false
        setFocused(next)
        return true
    }
    return { focused, setFocused, move }
}
