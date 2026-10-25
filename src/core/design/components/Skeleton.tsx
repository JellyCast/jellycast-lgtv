import { useEffect, useState } from 'preact/hooks'
import './skeleton.css'

const skeletonDelayMs = 100

/** Shows the skeleton only when loading takes longer than 100 ms, so fast data never flashes it. */
export function useDelayedVisible(loading: boolean): boolean {
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        if (!loading) {
            setVisible(false)
            return
        }
        const timer = window.setTimeout(() => setVisible(true), skeletonDelayMs)
        return () => window.clearTimeout(timer)
    }, [loading])
    return visible
}

interface BlockProps {
    width: number | string
    height: number
    index?: number
    radius?: number
    top?: number
}

/** A flat block whose opacity pulses 0.5–0.85 every 2 s; each block starts 120 ms after the previous. */
export function SkeletonBlock({ width, height, index = 0, radius = 8, top = 0 }: BlockProps) {
    return (
        <div
            class="skeleton"
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: `${height}px`,
                borderRadius: `${radius}px`,
                marginTop: `${top}px`,
                animationDelay: `${index * 120}ms`,
            }}
        />
    )
}
