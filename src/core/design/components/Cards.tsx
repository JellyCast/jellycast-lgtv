import { NeonEffect } from './NeonEffect'
import { memo } from 'preact/compat'
import { ArtworkImage } from './Artwork'
import './cards.css'

interface CardProps {
    focused: boolean
    onHover?: () => void
    onClick?: () => void
}

/** Poster 120×180; without an image the title stands in the flat block. */
export const PosterCard = memo(function PosterCard({ url, title, focused, onHover, onClick }: CardProps & { url: string | null; title: string }) {
    return (
        <div class={`card poster neon scale-105 ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            {url ? <ArtworkImage url={url} fadeMs={100} /> : <span class="card-title title-small muted clamp-3">{title}</span>}
            {focused && <NeonEffect mode="halo" />}
        </div>
    )
})

interface LandscapeProps extends CardProps {
    url: string | null
    title: string
    label?: string
    progress?: number | null
}

/** 196×110 with an optional progress bar and one line of text below. */
export const LandscapeCard = memo(function LandscapeCard({ url, title, label, progress, focused, onHover, onClick }: LandscapeProps) {
    return (
        <div class="landscape-item">
            <div class={`card landscape neon scale-105 ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
                {url ? <ArtworkImage url={url} fadeMs={100} /> : <span class="card-title title-small muted clamp-3">{title}</span>}
                {progress != null && <ProgressBar progress={progress} class="card-progress" />}
                {focused && <NeonEffect mode="halo" />}
            </div>
            {label && <div class="landscape-label label-medium ellipsis">{label}</div>}
        </div>
    )
})

export function ProgressBar({ progress, class: className }: { progress: number; class?: string }) {
    return (
        <div class={`progress ${className ?? ''}`}>
            <div class="progress-fill" style={{ clipPath: `inset(0 ${100 - Math.round(progress * 1000) / 10}% 0 0 round 1.5px)` }} />
        </div>
    )
}
