import { useEffect, useState } from 'preact/hooks'
import { BrandMark, BrandWordmark } from '../core/design/components/BrandMark'
import './splash.css'

const steadyFrameMs = 25
const steadyFramesNeeded = 2
const maxWaitFrames = 60
const drawMs = 600
const holdMs = 250
const fadeOutMs = 200
/** The app never waits on animation frames longer than this. */
const maxSplashMs = 1500

/** FastOutSlowIn, cubic-bezier(0.4, 0, 0.2, 1): solve x(s) = t with Newton steps, return y(s). */
function easeOut(t: number): number {
    const x1 = 0.4
    const x2 = 0.2
    let s = t
    for (let step = 0; step < 6; step++) {
        const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s - t
        const slope = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2)
        if (Math.abs(slope) < 1e-6) break
        s -= x / slope
    }
    return 3 * (1 - s) * s * s + s * s * s
}

/**
 * The brand draws itself once frames run steadily (drawing during the app's first busy frames made
 * the line stutter); the app starts building only after the line is drawn. Any key skips it.
 */
export function Splash({ onDrawn, onFinished }: { onDrawn: () => void; onFinished: () => void }) {
    const [progress, setProgress] = useState(0)
    const [leaving, setLeaving] = useState(false)
    useEffect(() => {
        let frame = 0
        let steady = 0
        let waited = 0
        let last = 0
        let start = 0
        const timers: number[] = []
        const finish = () => {
            setLeaving(true)
            timers.push(window.setTimeout(onFinished, fadeOutMs))
        }
        const draw = (now: number) => {
            if (!start) start = now
            const t = Math.min(1, (now - start) / drawMs)
            setProgress(easeOut(t))
            if (t < 1) frame = requestAnimationFrame(draw)
            else {
                onDrawn()
                timers.push(window.setTimeout(finish, holdMs))
            }
        }
        const waitForSteadyFrames = (now: number) => {
            if (last && now - last < steadyFrameMs) steady++
            else steady = 0
            last = now
            waited++
            frame = requestAnimationFrame(steady >= steadyFramesNeeded || waited >= maxWaitFrames ? draw : waitForSteadyFrames)
        }
        frame = requestAnimationFrame(waitForSteadyFrames)
        const skip = () => {
            cancelAnimationFrame(frame)
            onDrawn()
            onFinished()
        }
        timers.push(window.setTimeout(skip, maxSplashMs + drawMs))
        document.addEventListener('keydown', skip, { once: true })
        return () => {
            cancelAnimationFrame(frame)
            timers.forEach(window.clearTimeout)
            document.removeEventListener('keydown', skip)
        }
    }, [])
    return (
        <div class={`splash ${leaving ? 'leaving' : ''}`}>
            <BrandMark size={132} progress={progress} />
            <div class="splash-wordmark">
                <BrandWordmark />
            </div>
        </div>
    )
}
