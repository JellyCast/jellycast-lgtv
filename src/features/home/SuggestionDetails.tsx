import { ArtworkImage } from '../../core/design/components/Artwork'
import { t } from '../../core/i18n/i18n'
import type { SuggestionReason } from '../../core/data/homeRanking'
import { dynamicRangeLabel, episodeCode, episodeTime, movieMetaParts, resolutionLabel, seasonCountText, separator } from '../../core/ui/format'
import type { Suggestion } from './HomeSection'

const reasonKeys: Record<SuggestionReason, string> = {
    ContinueWatching: 'home_reason_continue',
    NewEpisode: 'home_reason_new_episode',
    NextEpisode: 'home_reason_next_episode',
    RecentlyAdded: 'home_reason_recently_added',
    ForTonight: 'home_reason_for_tonight',
}

/** Reason label, logo, meta and three lines of overview in a block of fixed height. */
export function SuggestionDetails({ suggestion }: { suggestion: Suggestion }) {
    const { item, series } = suggestion
    const logo = item.artwork.logo
    const title = series?.title ?? item.title
    const overview = item.overview ?? series?.overview ?? ''
    return (
        <div class="suggestion-details">
            <div class="reason label-medium">
                <span class="reason-dot" />
                <span>{t(reasonKeys[suggestion.reason])}</span>
            </div>
            <div class="suggestion-logo">
                {logo ? <ArtworkImage key={logo} url={logo} fadeMs={200} fit="contain" /> : <div class="display-small clamp-2">{title}</div>}
            </div>
            <div class="meta-row">
                {item.kind === 'movie' ? (
                    <>
                        {item.year && <span class="body-medium">{item.year}</span>}
                        <span class="body-medium muted ellipsis">{(item.year ? '·  ' : '') + movieMetaParts(item).join(separator)}</span>
                    </>
                ) : (
                    <>
                        <span class="title-small bold accent">{episodeCode(item.seasonNumber, item.episodeNumber)}</span>
                        <span class="title-small ellipsis">{item.title}</span>
                        <EpisodeParts parts={[episodeTime(item), series?.seasonCount ? seasonCountText(series.seasonCount) : null]} />
                    </>
                )}
            </div>
            <div class="suggestion-overview body-medium muted clamp-3">{overview}</div>
        </div>
    )
}

function EpisodeParts({ parts }: { parts: (string | null)[] }) {
    const present = parts.filter((part): part is string => !!part)
    return present.length ? <span class="body-medium muted ellipsis">{`·  ${present.join(separator)}`}</span> : null
}

/** Movies only: resolution · range · Atmos. */
export function SuggestionTechLine({ suggestion }: { suggestion: Suggestion }) {
    if (suggestion.item.kind !== 'movie') return <div class="home-tech" />
    const tech = suggestion.item.tech
    const parts = [
        tech.resolution && resolutionLabel(tech.resolution),
        tech.dynamicRange && dynamicRangeLabel(tech.dynamicRange),
        tech.hasAtmos && t('tech_atmos'),
    ].filter(Boolean)
    return <div class="home-tech label-medium tech muted">{parts.join(separator)}</div>
}
