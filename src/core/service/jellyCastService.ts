/** The JellyCast service (`../jellycast-api`): usage pings and ad placements. */

export interface AdCampaign {
    id: number
    position: number | null
    imageUrl: string
    title: string | null
    advertiser: string
    url: string | null
    untilMs: number
}

export interface AdPlacements {
    country: string | null
    home: AdCampaign | null
}

/** The test server on the home LAN, then the same machine over the VPN, until the service has a public address. */
const testAddresses = ['http://192.168.1.4:8090', 'http://10.8.0.1:8090']
// Points a test build elsewhere, set from `npm run tv:inspect`: localStorage.setItem('jellycast.serviceAddress', '…').
const addressOverrideKey = 'jellycast.serviceAddress'
const timeoutMs = 4000
const platform = 'webos'

function addresses(): string[] {
    try {
        const override = localStorage.getItem(addressOverrideKey)
        if (override) return [override]
    } catch {
        // No storage: the test addresses.
    }
    return testAddresses
}

interface DeviceInfo {
    modelName?: string
    platformVersion?: string
}

/** "OLED42C2PUA, webOS 24": from the TV's own device info, never the name the owner gave it. */
export function deviceDetails(): Record<string, string> {
    const system = (window as { webOSSystem?: { deviceInfo?: string }; PalmSystem?: { deviceInfo?: string } })
    let info: DeviceInfo = {}
    try {
        info = JSON.parse(system.webOSSystem?.deviceInfo ?? system.PalmSystem?.deviceInfo ?? '{}') as DeviceInfo
    } catch {
        // Not on a TV (the desktop browser): no model.
    }
    return {
        brand: 'LG',
        model: info.modelName ?? '',
        os: 'webOS',
        osVersion: info.platformVersion ?? '',
        appVersion: __APP_VERSION__,
    }
}

export async function sendPing(installId: string): Promise<void> {
    await firstAnswer('v1/ping', { method: 'POST', body: JSON.stringify({ id: installId, platform, ...deviceDetails() }) })
}

/** The placements as the service sends them; read them with [parsePlacements]. */
export async function fetchPlacements(): Promise<string> {
    return firstAnswer(`v1/placements?platform=${platform}`, { method: 'GET' })
}

async function firstAnswer(path: string, init: RequestInit): Promise<string> {
    let lastError: unknown = new Error('No service address')
    for (const address of addresses()) {
        const abort = new AbortController()
        const timer = window.setTimeout(() => abort.abort(), timeoutMs)
        try {
            const response = await fetch(`${address}/${path}`, {
                ...init,
                signal: abort.signal,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            })
            if (response.ok) return await response.text()
            lastError = new Error(`HTTP ${response.status} from ${address}`)
        } catch (error) {
            lastError = error
        } finally {
            window.clearTimeout(timer)
        }
    }
    throw lastError
}

interface CampaignDto {
    id: number
    position?: number | null
    image: string
    title?: string | null
    advertiser: string
    url?: string | null
    until: string
}

/** `null` for text that isn't placements, such as an error page. */
export function parsePlacements(text: string): AdPlacements | null {
    try {
        const dto = JSON.parse(text) as { country?: string | null; home?: CampaignDto | null }
        if (typeof dto !== 'object' || dto === null) return null
        return { country: dto.country ?? null, home: dto.home ? toCampaign(dto.home) : null }
    } catch {
        return null
    }
}

function toCampaign(dto: CampaignDto): AdCampaign | null {
    const untilMs = Date.parse(dto.until)
    if (Number.isNaN(untilMs) || typeof dto.image !== 'string' || typeof dto.advertiser !== 'string') return null
    return {
        id: dto.id,
        position: dto.position ?? null,
        imageUrl: dto.image,
        title: dto.title ?? null,
        advertiser: dto.advertiser,
        url: dto.url ?? null,
        untilMs,
    }
}
