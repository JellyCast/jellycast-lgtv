import { ArtworkImage } from '../../core/design/components/Artwork'
import { SkeletonBlock } from '../../core/design/components/Skeleton'
import type { SeriesShelfItem } from '../../core/data/shelves'
import { episodeCode, episodeTime, separator, seriesMetaParts } from '../../core/ui/format'
import './series.css'

/** Logo, one meta line and three lines of overview for the focused item. */
export function SeriesHero({ item }: { item: SeriesShelfItem }) {
    const logo = item.artwork.logo
    const title = item.kind === 'episode' ? item.seriesTitle : item.title
    return (
        <div class="series-hero">
            <div class="series-hero-logo">
                {logo ? <ArtworkImage key={logo} url={logo} fadeMs={200} fit="contain" /> : <div class="headline-small ellipsis">{title}</div>}
            </div>
            <div class="series-hero-meta">
                {item.kind === 'episode' ? (
                    <>
                        <span class="title-small bold accent">{episodeCode(item.seasonNumber, item.episodeNumber)}</span>
                        <span class="title-small ellipsis">{item.title}</span>
                        {episodeTime(item) && <span class="body-medium muted">{`·  ${episodeTime(item)}`}</span>}
                    </>
                ) : (
                    <span class="body-medium muted ellipsis">{seriesMetaParts(item).join(separator)}</span>
                )}
            </div>
            <div class="series-hero-overview body-medium muted clamp-3">{item.overview ?? ''}</div>
        </div>
    )
}

export function SeriesSkeleton() {
    return (
        <div class="series-skeleton">
            <SkeletonBlock width={260} height={41} index={0} />
            <SkeletonBlock width={220} height={18} index={1} top={10} radius={4} />
            <SkeletonBlock width={400} height={15} index={2} top={10} radius={4} />
            <SkeletonBlock width={380} height={15} index={3} top={6} radius={4} />
            <SkeletonBlock width={240} height={15} index={4} top={6} radius={4} />
            <SkeletonBlock width={120} height={20} index={5} top={34} radius={4} />
            <div class="series-skeleton-row">
                {[0, 1, 2, 3, 4].map((index) => (
                    <SkeletonBlock width={196} height={110} index={6 + index} />
                ))}
            </div>
        </div>
    )
}
