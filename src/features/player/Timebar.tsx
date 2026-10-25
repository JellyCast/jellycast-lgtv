import './player.css'

const timebarWidth = 864
const maxTailWidth = 52

interface TimebarProps {
    positionMs: number
    durationMs: number
    focused: boolean
    seeking: boolean
}

/** A 2 dp track with the progress gradient and the weld spark at the head; the spark grows while seeking. */
export function Timebar({ positionMs, durationMs, focused, seeking }: TimebarProps) {
    const fraction = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0
    const tailWidth = Math.min(maxTailWidth, fraction * timebarWidth)
    const sparkClass = seeking ? 'seeking' : focused ? 'focused' : ''
    return (
        <div class="timebar">
            <div class="timebar-track" />
            <div class="timebar-progress" style={{ transform: `scaleX(${fraction})` }} />
            <div class={`timebar-head ${sparkClass}`} style={{ left: `${fraction * 100}%` }}>
                <span class="timebar-tail" style={{ width: `${tailWidth}px` }} />
                <span class="timebar-spark" />
            </div>
        </div>
    )
}

export function formatClock(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = String(total % 60).padStart(2, '0')
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}
