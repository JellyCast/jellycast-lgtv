import { ArtworkImage } from './Artwork'
import './backdrops.css'

/** 720×405 in the top-right corner, fading into the background towards the bottom and the left. */
export function CornerBackdrop({ url }: { url: string | null }) {
    return (
        <div class="corner-backdrop">
            {url && <ArtworkImage key={url} url={url} fadeMs={200} />}
            <div class="corner-scrim" />
        </div>
    )
}

/** Full screen with one horizontal gradient: dark behind the text column on the left. */
export function FullBackdrop({ url, baseColor }: { url: string | null; baseColor?: string }) {
    return (
        <div class="full-backdrop" style={baseColor ? { background: baseColor } : undefined}>
            {url && <ArtworkImage key={url} url={url} fadeMs={200} />}
            {(url || baseColor) && <div class="full-scrim" />}
        </div>
    )
}
