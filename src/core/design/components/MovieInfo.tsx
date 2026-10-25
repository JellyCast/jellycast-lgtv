import { t } from '../../i18n/i18n'
import type { Movie } from '../../model/library'
import type { PlaybackTech } from '../../playback/tech'
import { dynamicRangeLabel, movieMetaParts, resolutionLabel, separator } from '../../ui/format'
import { ArtworkImage } from './Artwork'
import { SkeletonBlock } from './Skeleton'
import './movieInfo.css'

/** Logo (or title), meta line and overview; `overviewLines` 3 on overviews, up to 8 on the detail page. */
export function MovieInfo({ movie, overviewLines, showOverview = true }: { movie: Movie; overviewLines: 3 | 8; showOverview?: boolean }) {
    const logo = movie.artwork.logo
    return (
        <div class="movie-info">
            <div class="movie-logo">
                {logo ? <ArtworkImage key={logo} url={logo} fadeMs={200} fit="contain" /> : <div class="display-small clamp-2">{movie.title}</div>}
            </div>
            <div class="meta-row">
                {movie.year && <span class="body-medium">{movie.year}</span>}
                <span class="body-medium muted ellipsis">{(movie.year ? '·  ' : '') + movieMetaParts(movie).join(separator)}</span>
            </div>
            <div class={`movie-overview body-medium muted clamp-${overviewLines}`} style={{ visibility: showOverview ? 'visible' : 'hidden' }}>
                {movie.overview ?? ''}
            </div>
        </div>
    )
}

/** "4K · DOLBY VISION · DTS-HD MA → AC3 TRACK · DIRECT PLAY"; without a plan only what the file has. */
export function MovieTechLine({ movie, tech, visible = true }: { movie: Movie; tech: PlaybackTech | null; visible?: boolean }) {
    const parts = [
        movie.tech.resolution && resolutionLabel(movie.tech.resolution),
        tech ? tech.video : movie.tech.dynamicRange && dynamicRangeLabel(movie.tech.dynamicRange),
        tech ? tech.audio : movie.tech.hasAtmos && t('tech_atmos'),
        tech?.method,
    ].filter(Boolean)
    return (
        <div class="movie-tech label-medium tech muted" style={{ visibility: visible ? 'visible' : 'hidden' }}>
            {parts.join(separator)}
        </div>
    )
}

export function MovieInfoSkeleton() {
    return (
        <div class="movie-info">
            <SkeletonBlock width={300} height={74} index={0} />
            <SkeletonBlock width={260} height={18} index={1} top={6} radius={4} />
            <div>
                <SkeletonBlock width={440} height={15} index={2} top={6} radius={4} />
                <SkeletonBlock width={418} height={15} index={3} top={6} radius={4} />
                <SkeletonBlock width={264} height={15} index={4} top={6} radius={4} />
            </div>
        </div>
    )
}
