import { useEffect, useRef, useState } from 'preact/hooks'
import './neonEffect.css'

const restMs = 150
const haloExtent = 12
const haloSpread = 4
const haloSoftness = 4

/**
 * A soft glow around the shape: strongest at the outline, gone 12 dp out. Rendered once per size,
 * never per frame. The element's own shape is cut away in CSS (neonEffect.css), not here: Chrome 120
 * (webOS 25) ignored an SVG `feComposite out`, so the glow covered the element itself.
 */
function haloMask(width: number, height: number, radius: number): string {
    const w = width + haloExtent * 2
    const h = height + haloExtent * 2
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
        `<filter id='f' x='-50%' y='-50%' width='200%' height='200%'>` +
        `<feMorphology operator='dilate' radius='${haloSpread}' result='d'/>` +
        `<feGaussianBlur in='d' stdDeviation='${haloSoftness}'/></filter>` +
        `<rect x='${haloExtent}' y='${haloExtent}' width='${width}' height='${height}' rx='${radius}' fill='white' filter='url(#f)'/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** The element's own shape, rounded like it, to cut out of the glow. */
function shapeMask(width: number, height: number, radius: number): string {
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
        `<rect width='${width}' height='${height}' rx='${radius}' fill='white'/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * The resting focus effect inside a focused element: after 150 ms the static border fades out and the
 * halo (cards, pill buttons) or the comet (chips, rows, icons) takes over. Only transforms and
 * opacity animate, so the GPU turns the layers without repainting.
 */
export function NeonEffect({ mode }: { mode: 'halo' | 'comet' }) {
    const host = useRef<HTMLSpanElement>(null)
    const [resting, setResting] = useState(false)
    const [masks, setMasks] = useState<{ glow: string; shape: string } | null>(null)
    useEffect(() => {
        const timer = window.setTimeout(() => {
            const parent = host.current?.parentElement
            if (parent && mode === 'halo') {
                const radius = parseFloat(getComputedStyle(parent).borderTopLeftRadius) || 0
                const width = parent.offsetWidth
                const height = parent.offsetHeight
                setMasks({ glow: haloMask(width, height, radius), shape: shapeMask(width, height, Math.min(radius, height / 2)) })
            }
            setResting(true)
        }, restMs)
        return () => window.clearTimeout(timer)
    }, [])
    return (
        <span ref={host} class={`neon-effect ${mode} ${resting ? 'resting' : ''}`}>
            {mode === 'halo' && resting && masks && (
                <span class="halo-glow" style={{ '--halo-mask': masks.glow, '--halo-cut': masks.shape }}>
                    <span class="lamp lamp-a" />
                    <span class="lamp lamp-b" />
                </span>
            )}
            {mode === 'halo' && resting && (
                <span class="halo-line">
                    <span class="lamp lamp-a" />
                    <span class="lamp lamp-b" />
                </span>
            )}
            {mode === 'comet' && resting && (
                <span class="comet-ring">
                    <span class="comet-trail" />
                </span>
            )}
        </span>
    )
}
