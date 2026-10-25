import { toRemoteKey, type RemoteKey } from './remote'

export type LayerKey = RemoteKey | 'longEnter'

export interface KeyLayer {
    onKey: (key: LayerKey, repeat: boolean) => boolean
    /** When true for the focused element, OK acts on release and holding it gives `longEnter`. */
    wantsLongPress?: () => boolean
    /** False while the layer's screen is hidden under another screen. */
    isActive?: () => boolean
}

const longPressMs = 500
const repeatEndMs = 200
let repeatTimer = 0
const layers: KeyLayer[] = []
let pendingEnter: { layer: KeyLayer; timer: number } | null = null

export function pushKeyLayer(layer: KeyLayer): () => void {
    layers.push(layer)
    return () => {
        const index = layers.lastIndexOf(layer)
        if (index >= 0) layers.splice(index, 1)
        if (pendingEnter?.layer === layer) cancelPendingEnter()
    }
}

function activeLayers(): KeyLayer[] {
    return layers.filter((layer) => layer.isActive?.() ?? true).reverse()
}

/** Offers the key to the newest layer first; a layer that does not handle it passes it down. */
function dispatch(key: LayerKey, repeat: boolean, from = 0): boolean {
    const candidates = activeLayers()
    for (let index = from; index < candidates.length; index++) {
        if (candidates[index].onKey(key, repeat)) return true
    }
    return false
}

function cancelPendingEnter(): void {
    if (pendingEnter) window.clearTimeout(pendingEnter.timer)
    pendingEnter = null
}

/**
 * While a key repeats, scrolling lists jump instead of animating: retargeting a 150 ms transition
 * twenty times a second made vertical moves drop frames on the TVs.
 */
function markRepeat(): void {
    document.documentElement.classList.add('key-repeat')
    window.clearTimeout(repeatTimer)
}

function endRepeat(): void {
    window.clearTimeout(repeatTimer)
    repeatTimer = window.setTimeout(() => document.documentElement.classList.remove('key-repeat'), repeatEndMs)
}

function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) markRepeat()
    // A text field being edited handles its own keys (TvTextField).
    if (event.target instanceof HTMLInputElement) return
    const key = toRemoteKey(event)
    if (!key) return
    const layer = activeLayers()[0]
    if (key === 'enter' && layer?.wantsLongPress?.()) {
        event.preventDefault()
        if (event.repeat || pendingEnter) return
        const timer = window.setTimeout(() => {
            pendingEnter = null
            layer.onKey('longEnter', false)
        }, longPressMs)
        pendingEnter = { layer, timer }
        return
    }
    if (dispatch(key, event.repeat)) event.preventDefault()
}

function onKeyUp(event: KeyboardEvent): void {
    endRepeat()
    if (toRemoteKey(event) !== 'enter' || !pendingEnter) return
    const { layer } = pendingEnter
    cancelPendingEnter()
    if (!layer.onKey('enter', false)) dispatch('enter', false, 1)
}

let installed = false

export function installKeyLayers(): void {
    if (installed) return
    installed = true
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
}
