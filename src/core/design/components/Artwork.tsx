import { useState } from 'preact/hooks'

/** An image that fades in once decoded; until then the flat block of its parent shows. */
export function ArtworkImage({ url, fadeMs, fit = 'cover', class: className }: { url: string; fadeMs: number; fit?: 'cover' | 'contain'; class?: string }) {
    const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
    const loaded = loadedUrl === url
    return (
        <img
            class={`artwork ${className ?? ''}`}
            src={url}
            alt=""
            decoding="async"
            ref={(image) => {
                if (image?.complete && image.naturalWidth > 0 && !loaded) setLoadedUrl(url)
            }}
            onLoad={() => setLoadedUrl(url)}
            style={{
                width: '100%',
                height: '100%',
                objectFit: fit,
                objectPosition: fit === 'contain' ? 'left center' : 'center',
                opacity: loaded ? 1 : 0,
                transition: `opacity ${fadeMs}ms linear`,
            }}
        />
    )
}
