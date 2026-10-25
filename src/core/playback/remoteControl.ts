import type { JellyfinClient } from '../api/client'
import { deviceId } from '../api/session'
import { ticksPerMs } from '../model/library'

/** What the iOS app asks the player to do, through the server. */
export type RemoteCommand =
    | { kind: 'pause' }
    | { kind: 'unpause' }
    | { kind: 'playPause' }
    | { kind: 'stop' }
    | { kind: 'nextEpisode' }
    /** Replaces what plays; `startMs` is where the phone wants it to start, `streams` what it played there. */
    | { kind: 'play'; itemId: string; startMs: number; streams: RequestedStreams }
    | { kind: 'seek'; positionMs: number }
    | { kind: 'audioStream'; index: number }
    /** `null` turns subtitles off. */
    | { kind: 'subtitleStream'; index: number | null }

/** Server stream indexes; a subtitle of `null` is off. */
export interface RequestedStreams {
    audio?: number
    subtitle?: number | null
}

interface SocketMessage {
    MessageType?: string
    Data?: unknown
}

const noSubtitle = -1

export function toRemoteCommand(message: SocketMessage): RemoteCommand | null {
    const data = (message.Data ?? {}) as Record<string, unknown>
    if (message.MessageType === 'Playstate') {
        switch (data.Command) {
            case 'Pause':
                return { kind: 'pause' }
            case 'Unpause':
                return { kind: 'unpause' }
            case 'PlayPause':
                return { kind: 'playPause' }
            case 'Stop':
                return { kind: 'stop' }
            case 'NextTrack':
                return { kind: 'nextEpisode' }
            case 'Seek':
                return typeof data.SeekPositionTicks === 'number' ? { kind: 'seek', positionMs: data.SeekPositionTicks / ticksPerMs } : null
            default:
                return null
        }
    }
    // Only "play now" of one item: the player has no queue.
    if (message.MessageType === 'Play') {
        const itemId = (data.ItemIds as string[] | undefined)?.[0]
        if (data.PlayCommand !== 'PlayNow' || !itemId) return null
        const startTicks = typeof data.StartPositionTicks === 'number' ? data.StartPositionTicks : 0
        const streams: RequestedStreams = {}
        if (typeof data.AudioStreamIndex === 'number') streams.audio = data.AudioStreamIndex
        if (typeof data.SubtitleStreamIndex === 'number') streams.subtitle = data.SubtitleStreamIndex === noSubtitle ? null : data.SubtitleStreamIndex
        return { kind: 'play', itemId: itemId.replace(/-/g, ''), startMs: startTicks / ticksPerMs, streams }
    }
    if (message.MessageType === 'GeneralCommand') {
        const argument = (data.Arguments as Record<string, string> | undefined)?.Index
        const index = argument === undefined ? NaN : Number.parseInt(argument, 10)
        if (Number.isNaN(index)) return null
        if (data.Name === 'SetAudioStreamIndex') return { kind: 'audioStream', index }
        if (data.Name === 'SetSubtitleStreamIndex') return { kind: 'subtitleStream', index: index === noSubtitle ? null : index }
    }
    return null
}

const reconnectDelaysMs = [1000, 2000, 5000, 10_000, 30_000]
/** The keep-alive doesn't count as activity on the server, and the iOS app only lists recently active TVs. */
const presenceIntervalMs = 60_000

type CommandListener = (command: RemoteCommand) => void

/**
 * Tells the server this TV can be controlled and keeps the WebSocket that carries the commands
 * open for as long as the app runs, reconnecting after the network or the server drops it. The
 * most recent listener gets the commands: the player while it is open, otherwise the app.
 */
export class RemoteControl {
    private socket: WebSocket | null = null
    private listeners: CommandListener[] = []
    private keepAliveTimer = 0
    private reconnectTimer = 0
    private presenceTimer = 0
    private failures = 0
    private closed = false

    constructor(private readonly client: JellyfinClient) {}

    listen(listener: CommandListener): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((candidate) => candidate !== listener)
        }
    }

    start(): void {
        this.reportPresence()
        this.presenceTimer = window.setInterval(() => this.reportPresence(), presenceIntervalMs)
        this.connect()
    }

    private reportPresence(): void {
        this.client
            .post('/Sessions/Capabilities/Full', {
                PlayableMediaTypes: ['Video'],
                SupportedCommands: ['SetAudioStreamIndex', 'SetSubtitleStreamIndex'],
                SupportsMediaControl: true,
                SupportsPersistentIdentifier: true,
            })
            .catch((error) => console.warn('[remote] capabilities', String(error)))
    }

    stop(): void {
        this.closed = true
        window.clearInterval(this.keepAliveTimer)
        window.clearTimeout(this.reconnectTimer)
        window.clearInterval(this.presenceTimer)
        this.socket?.close()
        this.socket = null
    }

    private connect(): void {
        if (this.closed || !this.client.accessToken) return
        const base = this.client.serverUrl.replace(/^http/, 'ws')
        const socket = new WebSocket(`${base}/socket?api_key=${encodeURIComponent(this.client.accessToken)}&deviceId=${encodeURIComponent(deviceId())}`)
        this.socket = socket
        socket.onopen = () => {
            this.failures = 0
        }
        socket.onmessage = (event) => this.receive(event.data)
        socket.onclose = () => {
            window.clearInterval(this.keepAliveTimer)
            if (this.closed) return
            const delay = reconnectDelaysMs[Math.min(this.failures, reconnectDelaysMs.length - 1)]
            this.failures++
            this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
        }
    }

    private receive(raw: unknown): void {
        let message: SocketMessage
        try {
            message = JSON.parse(String(raw)) as SocketMessage
        } catch {
            return
        }
        // The server closes a socket that stays quiet; it says how long it waits in seconds.
        if (message.MessageType === 'ForceKeepAlive' && typeof message.Data === 'number') {
            window.clearInterval(this.keepAliveTimer)
            this.keepAliveTimer = window.setInterval(() => this.send('KeepAlive'), (message.Data * 1000) / 2)
            this.send('KeepAlive')
            return
        }
        const command = toRemoteCommand(message)
        if (command) this.listeners[this.listeners.length - 1]?.(command)
    }

    private send(type: string): void {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ MessageType: type }))
    }
}
