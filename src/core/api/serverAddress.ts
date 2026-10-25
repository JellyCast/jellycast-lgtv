const defaultHttpPort = 8096

/**
 * Turns what the user typed into a server URL: http when no scheme, port 8096 for http without a
 * port, and without a trailing /web part. Null when it is not a usable address.
 */
export function normalizeServerAddress(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed || /\s/.test(trimmed)) return null
    const withScheme = trimmed.includes('://') ? trimmed : `http://${trimmed}`
    let url: URL
    try {
        url = new URL(withScheme)
    } catch {
        return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname) return null
    const port = url.port || (url.protocol === 'http:' ? String(defaultHttpPort) : '')
    let path = url.pathname.replace(/\/$/, '')
    path = path.replace(/\/web\/index\.html$/, '').replace(/\/web$/, '').replace(/\/$/, '')
    return `${url.protocol}//${url.hostname}${port ? `:${port}` : ''}${path}`
}
