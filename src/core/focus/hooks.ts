import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { useIsActiveScreen } from '../navigation/Navigator'
import { pushKeyLayer, type KeyLayer } from './keyLayers'

/**
 * Registers a key handler for the lifetime of the component; the newest layer gets the keys.
 * Registered in the commit itself, not after paint, so the first key after a screen opens is not lost.
 */
export function useKeyLayer(onKey: KeyLayer['onKey'], wantsLongPress?: () => boolean): void {
    const active = useIsActiveScreen()
    const latest = useRef({ onKey, wantsLongPress, active })
    latest.current = { onKey, wantsLongPress, active }
    useLayoutEffect(
        () =>
            pushKeyLayer({
                onKey: (key, repeat) => latest.current.onKey(key, repeat),
                wantsLongPress: () => latest.current.wantsLongPress?.() ?? false,
                isActive: () => latest.current.active,
            }),
        [],
    )
}

/** The value once it has not changed for `delayMs`: what the focus rests on, not what it passes. */
export function useRested<T>(value: T, delayMs: number): T {
    const [rested, setRested] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setRested(value), delayMs)
        return () => window.clearTimeout(timer)
    }, [value, delayMs])
    return rested
}

/** True once `key` has stayed the same for `delayMs`; false again right after it changes. */
export function useResting(key: unknown, delayMs: number): boolean {
    const [resting, setResting] = useState(false)
    useEffect(() => {
        setResting(false)
        const timer = window.setTimeout(() => setResting(true), delayMs)
        return () => window.clearTimeout(timer)
    }, [key, delayMs])
    return resting
}
