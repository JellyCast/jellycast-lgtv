export type ImageType = 'Primary' | 'Backdrop' | 'Logo' | 'Thumb'

/** Widths in px: the display size in dp × 2, as in the Android app. */
export const imageWidths = {
    poster: 240,
    landscape: 392,
    backdrop: 1280,
    logo: 800,
    spinePoster: 88,
    spineLogo: 480,
} as const

const imageQuality = 85

/** Always with the image tag, so the URL changes when the image does and is safe to cache. */
export function imageUrl(
    serverUrl: string,
    itemId: string,
    type: ImageType,
    tag: string,
    fillWidth: number,
    index?: number,
): string {
    const path = index === undefined ? type : `${type}/${index}`
    return `${serverUrl}/Items/${itemId}/Images/${path}?fillWidth=${fillWidth}&quality=${imageQuality}&tag=${tag}`
}
