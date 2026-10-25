import { describe, expect, it } from 'vitest'
import { normalizeServerAddress } from './serverAddress'

describe('normalizeServerAddress', () => {
    it('adds http and the default port to a bare address', () => {
        expect(normalizeServerAddress(' 192.168.1.4 ')).toBe('http://192.168.1.4:8096')
    })

    it('drops the web client path', () => {
        expect(normalizeServerAddress('http://192.168.1.4:8096/web/index.html')).toBe('http://192.168.1.4:8096')
    })

    it('keeps https without a port', () => {
        expect(normalizeServerAddress('https://jelly.example.com/')).toBe('https://jelly.example.com')
    })

    it('rejects whitespace and other schemes', () => {
        expect(normalizeServerAddress('my server')).toBeNull()
        expect(normalizeServerAddress('ftp://host')).toBeNull()
    })
})
