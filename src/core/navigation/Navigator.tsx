import { createContext, type ComponentChildren } from 'preact'
import { useContext, useMemo, useState } from 'preact/hooks'
import type { Route, StackEntry } from './routes'

export interface Navigator {
    push: (route: Route) => void
    back: () => void
    /** Clears the stack, for signing in and out. */
    reset: (route: Route) => void
    replace: (route: Route) => void
}

const NavigatorContext = createContext<Navigator | null>(null)
const ActiveContext = createContext(true)

let nextKey = 1

export function useNavigator(): Navigator {
    const navigator = useContext(NavigatorContext)
    if (!navigator) throw new Error('useNavigator outside NavigatorHost')
    return navigator
}

/** Whether this screen is the top of the stack; hidden screens keep their state but pause work. */
export function useIsActiveScreen(): boolean {
    return useContext(ActiveContext)
}

interface HostProps {
    initial: Route
    render: (route: Route) => ComponentChildren
    onExitRequest: () => void
    /** Stays mounted for as long as the stack, with access to the navigator. */
    children?: ComponentChildren
}

/**
 * Keeps every screen on the stack mounted and hides all but the top one, so Back returns to the
 * same focus and scroll position without reloading.
 */
export function NavigatorHost({ initial, render, onExitRequest, children }: HostProps) {
    const [stack, setStack] = useState<StackEntry[]>(() => [{ key: nextKey++, route: initial }])
    const navigator = useMemo<Navigator>(
        () => ({
            push: (route) => setStack((current) => [...current, { key: nextKey++, route }]),
            back: () =>
                setStack((current) => {
                    if (current.length > 1) return current.slice(0, -1)
                    onExitRequest()
                    return current
                }),
            reset: (route) => setStack([{ key: nextKey++, route }]),
            replace: (route) => setStack((current) => [...current.slice(0, -1), { key: nextKey++, route }]),
        }),
        [onExitRequest],
    )
    return (
        <NavigatorContext.Provider value={navigator}>
            {stack.map((entry, index) => {
                const active = index === stack.length - 1
                return (
                    <ActiveContext.Provider key={entry.key} value={active}>
                        <div class="screen" hidden={!active}>
                            {render(entry.route)}
                        </div>
                    </ActiveContext.Provider>
                )
            })}
            {children}
        </NavigatorContext.Provider>
    )
}
