import { useEffect, useRef, useState } from 'preact/hooks'

export type Load<T> = { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'error' }

const loadTimeoutMs = 10_000
const lastData = new Map<string, unknown>()

function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), loadTimeoutMs)),
    ])
}

/**
 * Loads when `trigger` becomes true (a section that appears, a screen that is shown) and keeps the
 * old data on screen while it reloads; a failure only shows when there is nothing to show. The last
 * result per `cacheKey` survives the component, so a section that comes back shows it straight away.
 */
export function useLoad<T>(cacheKey: string, load: () => Promise<T>, trigger: boolean) {
    const [state, setState] = useState<Load<T>>(() =>
        lastData.has(cacheKey) ? { kind: 'ready', data: lastData.get(cacheKey) as T } : { kind: 'loading' },
    )
    const inFlight = useRef(false)
    const latestLoad = useRef(load)
    latestLoad.current = load

    const run = (force = false) => {
        if (inFlight.current && !force) return
        inFlight.current = true
        withTimeout(latestLoad.current())
            .then((data) => {
                lastData.set(cacheKey, data)
                setState({ kind: 'ready', data })
            })
            .catch(() => setState((current) => (current.kind === 'ready' ? current : { kind: 'error' })))
            .finally(() => {
                inFlight.current = false
            })
    }

    useEffect(() => {
        if (trigger) run()
    }, [trigger])

    const retry = () => {
        setState({ kind: 'loading' })
        run(true)
    }
    return { state, reload: () => run(true), retry, setData: (data: T) => setState({ kind: 'ready', data }) }
}

export function forgetLoadedData(): void {
    lastData.clear()
}
