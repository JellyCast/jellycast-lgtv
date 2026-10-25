import { JellyfinClient, JellyfinError } from './client'
import { normalizeServerAddress } from './serverAddress'
import type { Session } from './session'

interface PublicSystemInfo {
    ServerName?: string
    Version?: string
    ProductName?: string
}

interface User {
    Id: string
    Name: string
    Configuration?: { SubtitleLanguagePreference?: string; AudioLanguagePreference?: string }
}

interface AuthenticationResult {
    AccessToken: string
    User: User
}

interface QuickConnectResult {
    Secret: string
    Code: string
    Authenticated: boolean
}

export type ServerCheck =
    | { kind: 'ok'; serverUrl: string; serverName: string; version: string }
    | { kind: 'invalid' }
    | { kind: 'unreachable' }
    | { kind: 'notJellyfin' }
    | { kind: 'tooOld'; version: string }

const minimumVersion = [10, 11, 0]
const serverCheckTimeoutMs = 8000
const quickConnectPollMs = 3000

function isSupported(version: string): boolean {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10) || 0)
    for (let index = 0; index < minimumVersion.length; index++) {
        if ((parts[index] ?? 0) !== minimumVersion[index]) return (parts[index] ?? 0) > minimumVersion[index]
    }
    return true
}

export async function checkServer(input: string): Promise<ServerCheck> {
    const serverUrl = normalizeServerAddress(input)
    if (!serverUrl) return { kind: 'invalid' }
    let info: PublicSystemInfo
    try {
        info = await new JellyfinClient(serverUrl).get<PublicSystemInfo>('/System/Info/Public', serverCheckTimeoutMs)
    } catch (error) {
        if (error instanceof JellyfinError) return error.status === 404 ? { kind: 'notJellyfin' } : { kind: 'unreachable' }
        if (error instanceof SyntaxError) return { kind: 'notJellyfin' }
        return { kind: 'unreachable' }
    }
    if (!info.ProductName?.toLowerCase().includes('jellyfin')) return { kind: 'notJellyfin' }
    const version = info.Version ?? '0'
    if (!isSupported(version)) return { kind: 'tooOld', version }
    return { kind: 'ok', serverUrl, serverName: info.ServerName ?? serverUrl, version }
}

export type PasswordResult = { kind: 'ok'; session: Session } | { kind: 'invalidCredentials' } | { kind: 'unreachable' }

export async function signInWithPassword(serverUrl: string, serverName: string, userName: string, password: string): Promise<PasswordResult> {
    try {
        const result = await new JellyfinClient(serverUrl).post<AuthenticationResult>('/Users/AuthenticateByName', {
            Username: userName,
            Pw: password,
        })
        return { kind: 'ok', session: toSession(serverUrl, serverName, result) }
    } catch (error) {
        return error instanceof JellyfinError && error.status === 401 ? { kind: 'invalidCredentials' } : { kind: 'unreachable' }
    }
}

export async function isQuickConnectEnabled(serverUrl: string): Promise<boolean> {
    return new JellyfinClient(serverUrl).get<boolean>('/QuickConnect/Enabled')
}

/**
 * Shows a code via `onCode` and waits for approval on another device. A code the server forgets
 * (404) is replaced by a new one.
 */
export async function quickConnect(serverUrl: string, serverName: string, onCode: (code: string) => void, signal: AbortSignal): Promise<Session> {
    const client = new JellyfinClient(serverUrl)
    const sleep = () => new Promise((resolve) => setTimeout(resolve, quickConnectPollMs))
    while (!signal.aborted) {
        const { Code, Secret } = await client.post<QuickConnectResult>('/QuickConnect/Initiate')
        onCode(Code)
        while (!signal.aborted) {
            await sleep()
            if (signal.aborted) break
            let state: QuickConnectResult
            try {
                state = await client.get<QuickConnectResult>(`/QuickConnect/Connect?secret=${encodeURIComponent(Secret)}`)
            } catch (error) {
                if (error instanceof JellyfinError && error.status === 404) break
                throw error
            }
            if (state.Authenticated) {
                const result = await client.post<AuthenticationResult>('/Users/AuthenticateWithQuickConnect', { Secret })
                return toSession(serverUrl, serverName, result)
            }
        }
    }
    throw new DOMException('Quick Connect cancelled', 'AbortError')
}

/** False only when the server says the token is no longer valid; other errors keep the user signed in. */
export async function validateSession(
    session: Session,
): Promise<{ valid: boolean; userName?: string; preferredLanguages?: string[] }> {
    try {
        const user = await new JellyfinClient(session.serverUrl, session.accessToken).get<User>('/Users/Me')
        return { valid: true, userName: user.Name, preferredLanguages: preferredLanguages(user) }
    } catch (error) {
        return { valid: !(error instanceof JellyfinError && error.status === 401) }
    }
}

export async function signOut(session: Session): Promise<void> {
    try {
        await new JellyfinClient(session.serverUrl, session.accessToken).post('/Sessions/Logout')
    } catch {
        // The local session is cleared regardless.
    }
}

function toSession(serverUrl: string, serverName: string, result: AuthenticationResult): Session {
    return {
        serverUrl,
        serverName,
        userId: result.User.Id,
        userName: result.User.Name,
        accessToken: result.AccessToken,
        preferredLanguages: preferredLanguages(result.User),
    }
}

function preferredLanguages(user: User): string[] {
    const { SubtitleLanguagePreference, AudioLanguagePreference } = user.Configuration ?? {}
    return [...new Set([SubtitleLanguagePreference, AudioLanguagePreference].filter((code): code is string => !!code))]
}
