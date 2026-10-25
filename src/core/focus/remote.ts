export type Direction = 'up' | 'down' | 'left' | 'right'
export type RemoteKey =
    | Direction
    | 'enter'
    | 'back'
    | 'playPause'
    | 'play'
    | 'pause'
    | 'stop'
    | 'rewind'
    | 'fastForward'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'

const keyCodes: Record<number, RemoteKey> = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    13: 'enter',
    461: 'back',
    27: 'back',
    8: 'back',
    415: 'play',
    19: 'pause',
    463: 'playPause',
    413: 'stop',
    412: 'rewind',
    417: 'fastForward',
    403: 'red',
    404: 'green',
    405: 'yellow',
    406: 'blue',
}

export function toRemoteKey(event: KeyboardEvent): RemoteKey | null {
    // Backspace only counts as Back outside text fields.
    if (event.keyCode === 8 && event.target instanceof HTMLInputElement) return null
    return keyCodes[event.keyCode] ?? null
}

export function isDirection(key: RemoteKey): key is Direction {
    return key === 'up' || key === 'down' || key === 'left' || key === 'right'
}
