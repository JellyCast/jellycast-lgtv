export interface Session {
    serverUrl: string
    serverName: string
    userId: string
    userName: string
    accessToken: string
    /** The user's subtitle language first, then the audio language; codes as the server has them. */
    preferredLanguages?: string[]
}

const sessionKey = 'jellycast.session'
const serverKey = 'jellycast.server'
const deviceIdKey = 'jellycast.deviceId'

export function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(sessionKey)
        const session = raw ? (JSON.parse(raw) as Session) : null
        return session ? { ...session, serverName: session.serverName ?? session.serverUrl } : null
    } catch {
        return null
    }
}

export function saveSession(session: Session): void {
    try {
        localStorage.setItem(sessionKey, JSON.stringify(session))
    } catch {
        // Without storage the user signs in again next launch.
    }
}

export function clearSession(): void {
    try {
        localStorage.removeItem(sessionKey)
    } catch {
        // Nothing stored, nothing to clear.
    }
}

export interface KnownServer {
    serverUrl: string
    serverName: string
}

/** The last server, kept after signing out so the server screen can offer it. */
export function loadServer(): KnownServer | null {
    try {
        const raw = localStorage.getItem(serverKey)
        return raw ? (JSON.parse(raw) as KnownServer) : null
    } catch {
        return null
    }
}

export function saveServer(server: KnownServer): void {
    try {
        localStorage.setItem(serverKey, JSON.stringify(server))
    } catch {
        // Without storage the address is asked again.
    }
}

export function deviceId(): string {
    try {
        const stored = localStorage.getItem(deviceIdKey)
        if (stored) return stored
        const created = `webos-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`
        localStorage.setItem(deviceIdKey, created)
        return created
    } catch {
        return 'webos-unknown'
    }
}
