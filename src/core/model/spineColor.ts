const base83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
const defaultSpineRgb = 0x2a2a2e
const darkLogoLightness = 0.38
const darkSpineLightness = 0.15
const lightSpineLightness = 0.8

/**
 * Average color (0xRRGGBB) of a BlurHash: characters 2–5 are the DC component, which is exactly the
 * image's average color. A spine color thus costs no request and no image analysis on the TV.
 */
export function blurHashAverageColor(hash: string | null | undefined): number | null {
    if (!hash || hash.length < 6) return null
    let value = 0
    for (const char of hash.substring(2, 6)) {
        const digit = base83.indexOf(char)
        if (digit < 0) return null
        value = value * 83 + digit
    }
    return value
}

export function rgbToHsl(rgb: number): [number, number, number] {
    const r = ((rgb >> 16) & 0xff) / 255
    const g = ((rgb >> 8) & 0xff) / 255
    const b = (rgb & 0xff) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d === 0) return [0, 0, l]
    const s = d / (1 - Math.abs(2 * l - 1))
    const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus
    const h = max === r ? 60 * mod((g - b) / d, 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
    return [h, s, l]
}

export function hslToRgb(h: number, s: number, l: number): number {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2
    const [r, g, b] =
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
    const channel = (value: number) => Math.min(255, Math.max(0, Math.floor((value + m) * 255 + 0.5)))
    return (channel(r) << 16) | (channel(g) << 8) | channel(b)
}

function toCss(rgb: number): string {
    return `#${rgb.toString(16).padStart(6, '0')}`
}

/** A dark logo gets a light spine; on a dark spine it would disappear. */
export function spineColor(posterBlurHash: string | null, logoBlurHash: string | null) {
    const poster = blurHashAverageColor(posterBlurHash) ?? defaultSpineRgb
    const logoAverage = blurHashAverageColor(logoBlurHash)
    const isLight = logoAverage !== null && rgbToHsl(logoAverage)[2] < darkLogoLightness
    const [h, s] = rgbToHsl(poster)
    return {
        color: toCss(hslToRgb(h, s, isLight ? lightSpineLightness : darkSpineLightness)),
        darkColor: toCss(hslToRgb(h, s, darkSpineLightness)),
        isLight,
    }
}
