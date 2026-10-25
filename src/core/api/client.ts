import { deviceId } from './session'

const clientName = 'JellyCast'
const clientVersion = __APP_VERSION__
const deviceName = 'LG webOS TV'

export class JellyfinError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message)
    }
}

export function authorizationHeader(accessToken?: string): string {
    const parts = [
        `Client="${clientName}"`,
        `Device="${deviceName}"`,
        `DeviceId="${deviceId()}"`,
        `Version="${clientVersion}"`,
    ]
    if (accessToken) parts.push(`Token="${accessToken}"`)
    return `MediaBrowser ${parts.join(', ')}`
}

export class JellyfinClient {
    constructor(
        readonly serverUrl: string,
        readonly accessToken?: string,
    ) {}

    async get<T>(path: string, timeoutMs?: number): Promise<T> {
        return this.request<T>('GET', path, undefined, timeoutMs)
    }

    async post<T>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('POST', path, body)
    }

    async delete(path: string): Promise<void> {
        await this.request<void>('DELETE', path)
    }

    private async request<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
        const headers: Record<string, string> = {
            Authorization: authorizationHeader(this.accessToken),
        }
        if (body !== undefined) headers['Content-Type'] = 'application/json'
        const response = await fetch(`${this.serverUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
        })
        if (!response.ok) {
            throw new JellyfinError(response.status, `${method} ${path} → ${response.status}`)
        }
        const text = await response.text()
        return (text ? JSON.parse(text) : undefined) as T
    }
}
