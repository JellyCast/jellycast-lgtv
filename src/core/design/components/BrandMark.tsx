import { useState } from 'preact/hooks'

const points: [number, number][] = [
    [134, 91.6],
    [100, 30],
    [28, 160],
    [172, 160],
    [134, 91.6],
]
const segments = points.slice(1).map((point, index) => {
    const [x0, y0] = points[index]
    return { from: points[index], to: point, length: Math.hypot(point[0] - x0, point[1] - y0) }
})
const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0)
const tailLength = 37

function pointAt(distance: number): { x: number; y: number; angle: number } {
    let rest = Math.max(0, Math.min(distance, totalLength))
    for (const segment of segments) {
        if (rest <= segment.length || segment === segments[segments.length - 1]) {
            const t = segment.length ? Math.min(1, rest / segment.length) : 0
            const [x0, y0] = segment.from
            const [x1, y1] = segment.to
            return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI }
        }
        rest -= segment.length
    }
    return { x: points[0][0], y: points[0][1], angle: 0 }
}

let instances = 0

const path = `M${points.map(([x, y]) => `${x},${y}`).join(' L')}`

/**
 * The Cast triangle: the Jellyfin triangle as one neon line with a dot and two arcs inside, drawn in
 * from the right edge; the weld spark sits on the head of the line.
 */
export function BrandMark({ size, progress = 1 }: { size: number; progress?: number }) {
    // Gradient ids must be unique: a hidden screen with the same ids would hide this one's strokes.
    const [idPrefix] = useState(() => `brand-${++instances}`)
    const drawn = progress * totalLength
    const head = pointAt(drawn)
    const tail = pointAt(drawn - tailLength)
    const signalAlpha = Math.max(0, Math.min(1, (progress - 0.6) / 0.4))
    const dash = `${drawn} ${totalLength + 1}`
    const gradient = `${idPrefix}-gradient`
    const weld = `${idPrefix}-weld`
    const glow = `${idPrefix}-glow`
    return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
            <defs>
                <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="170" y2="165">
                    <stop offset="0" stop-color="#7FC8FF" />
                    <stop offset="0.4" stop-color="#F2F6FF" />
                    <stop offset="0.75" stop-color="#9B6BFF" />
                    <stop offset="1" stop-color="#FF6EC7" />
                </linearGradient>
                <linearGradient id={weld} gradientUnits="userSpaceOnUse" x1={tail.x} y1={tail.y} x2={head.x} y2={head.y}>
                    <stop offset="0" stop-color="#B9A6F2" stop-opacity="0" />
                    <stop offset="0.6" stop-color="#D9CCFF" />
                    <stop offset="1" stop-color="#FFFFFF" />
                </linearGradient>
                <radialGradient id={glow}>
                    <stop offset="0" stop-color="#9B6BFF" stop-opacity="0.7" />
                    <stop offset="1" stop-color="#9B6BFF" stop-opacity="0" />
                </radialGradient>
            </defs>
            <g fill="none" stroke={`url(#${gradient})`} stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={dash}>
                <path d={path} stroke-width="20" stroke-opacity="0.06" />
                <path d={path} stroke-width="13" stroke-opacity="0.13" />
                <path d={path} stroke-width="7" />
            </g>
            {signalAlpha > 0 && (
                <g opacity={signalAlpha} fill="none" stroke={`url(#${gradient})`} stroke-width="6" stroke-linecap="round">
                    <circle cx="100" cy="138" r="6" fill={`url(#${gradient})`} stroke="none" />
                    <path d="M82,138 A18,18 0 0 1 118,138" />
                    <path d="M68,138 A32,32 0 0 1 132,138" />
                </g>
            )}
            {progress > 0 && (
                <g>
                    <line x1={tail.x} y1={tail.y} x2={head.x} y2={head.y} stroke={`url(#${weld})`} stroke-width="5" stroke-linecap="round" />
                    <circle cx={head.x} cy={head.y} r="14" fill={`url(#${glow})`} />
                    <ellipse cx={head.x} cy={head.y} rx="7" ry="3" fill="#FFFFFF" transform={`rotate(${head.angle} ${head.x} ${head.y})`} />
                </g>
            )}
        </svg>
    )
}

/** "Jelly" bold in text color, directly followed by "Cast" light in lavender. */
export function BrandWordmark({ scale = 1 }: { scale?: number }) {
    return (
        <div class="display-small" style={{ letterSpacing: '-0.02em', fontSize: `${36 * scale}px`, lineHeight: `${42 * scale}px` }}>
            <span class="bold">Jelly</span>
            <span class="light accent">Cast</span>
        </div>
    )
}
