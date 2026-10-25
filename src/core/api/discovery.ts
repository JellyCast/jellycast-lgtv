import { normalizeServerAddress } from './serverAddress'

export interface DiscoveredServer {
    serverUrl: string
    serverName: string
}

interface DiscoverResponse {
    returnValue: boolean
    servers?: { id: string; name: string; address: string }[]
}

interface PalmServiceBridge {
    onservicecallback: (response: string) => void
    call(uri: string, payload: string): void
}

declare global {
    interface Window {
        PalmServiceBridge?: new () => PalmServiceBridge
    }
}

const discoverUri = 'luna://nl.jellycast.webos.service/discover'
const responseTimeoutMs = 8000

// Without a reference the bridge can be garbage collected before the reply arrives.
const pendingBridges = new Set<PalmServiceBridge>()

/**
 * Jellyfin servers that answer the UDP discovery, asked through the app's own service
 * (`service/`). Empty outside webOS, where there is no service bus.
 */
export function discoverServers(): Promise<DiscoveredServer[]> {
    const Bridge = window.PalmServiceBridge
    if (!Bridge) return Promise.resolve([])
    return new Promise((resolve) => {
        const bridge = new Bridge()
        pendingBridges.add(bridge)
        const finish = (servers: DiscoveredServer[]) => {
            pendingBridges.delete(bridge)
            resolve(servers)
        }
        const timeout = window.setTimeout(() => finish([]), responseTimeoutMs)
        bridge.onservicecallback = (raw) => {
            window.clearTimeout(timeout)
            finish(toServers(raw))
        }
        bridge.call(discoverUri, '{}')
    })
}

function toServers(raw: string): DiscoveredServer[] {
    let response: DiscoverResponse
    try {
        response = JSON.parse(raw) as DiscoverResponse
    } catch {
        return []
    }
    if (!response.returnValue) console.warn('Server discovery failed', raw)
    const servers: DiscoveredServer[] = []
    for (const server of response.servers ?? []) {
        const serverUrl = normalizeServerAddress(server.address)
        if (!serverUrl || servers.some((known) => known.serverUrl === serverUrl)) continue
        servers.push({ serverUrl, serverName: server.name.trim() || serverUrl })
    }
    return servers
}
