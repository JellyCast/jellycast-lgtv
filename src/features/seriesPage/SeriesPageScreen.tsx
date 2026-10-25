import { NeonEffect } from '../../core/design/components/NeonEffect'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { memo } from 'preact/compat'
import { useApp } from '../../app/AppContext'
import { pickBackdrop } from '../../core/data/backdrops'
import { ArtworkImage } from '../../core/design/components/Artwork'
import { CornerBackdrop } from '../../core/design/components/Backdrops'
import { PillButton } from '../../core/design/components/Buttons'
import { ProgressBar } from '../../core/design/components/Cards'
import { ErrorState } from '../../core/design/components/Common'
import { Icon } from '../../core/design/components/Icon'
import { Rows, type RowModel } from '../../core/design/components/Rows'
import { SkeletonBlock, useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer, useRested } from '../../core/focus/hooks'
import { plural, t } from '../../core/i18n/i18n'
import { progressOf, remainingMs, type Episode, type Series } from '../../core/model/library'
import { useIsActiveScreen, useNavigator } from '../../core/navigation/Navigator'
import { episodeCode, episodeTime, remainingText, separator, seriesMetaParts } from '../../core/ui/format'
import { continueOrFirst, groupSeasons, withPlayed, type Season } from './seasons'
import './seriesPage.css'

type TopButton = 'continue' | 'markNext' | 'series'
type SeasonItem = Episode | { kind: 'markSeason'; id: string; season: Season }

const restMs = 300
const rowHeight = 138
const headerHeight = 32
const cardTop = 56

export function SeriesPageScreen({ seriesId, focusEpisodeId }: { seriesId: string; focusEpisodeId?: string }) {
    const { library } = useApp()
    const navigator = useNavigator()
    const active = useIsActiveScreen()
    const [series, setSeries] = useState<Series | null>(() => library.peekSeries(seriesId))
    const [episodes, setEpisodes] = useState<Episode[] | null>(() => library.peekEpisodes(seriesId))
    const [failed, setFailed] = useState(false)
    const [zone, setZone] = useState<'top' | 'seasons'>('top')
    const [topButton, setTopButton] = useState<TopButton>('continue')
    const [cell, setCell] = useState({ row: 0, col: 0 })
    const pendingWrites = useRef(0)
    const pendingFocus = useRef(focusEpisodeId ?? null)

    const load = useCallback(() => {
        library.getSeriesById(seriesId).then((value) => value && setSeries(value)).catch(() => undefined)
        library
            .getEpisodes(seriesId)
            .then((list) => {
                if (pendingWrites.current === 0) setEpisodes(list)
                setFailed(false)
            })
            .catch(() => setFailed(true))
    }, [seriesId])
    useEffect(() => {
        if (active) load()
    }, [active])

    const seasons = useMemo(() => (episodes ? groupSeasons(episodes) : []), [episodes])
    const next = useMemo(() => (episodes ? continueOrFirst(episodes) : null), [episodes])
    const isWatched = seasons.length > 0 && seasons.every((season) => season.episodes.every((episode) => episode.isPlayed))
    const markableNext = next && !next.isPlayed ? next : null
    const isUnstarted = seasons.every((season) => season.episodes.every((episode) => !episode.isPlayed)) && (next?.resumePositionMs ?? 0) === 0
    const topButtons: TopButton[] = ['continue', ...(markableNext ? (['markNext'] as const) : []), 'series']

    useEffect(() => {
        if (!topButtons.includes(topButton)) setTopButton(topButtons[Math.min(1, topButtons.length - 1)])
    }, [topButtons.join()])

    useEffect(() => {
        if (next) library.warmUp(next.id)
    }, [next?.id])

    // Opening from "Go to series" puts the focus on that episode once the seasons are there.
    useEffect(() => {
        const id = pendingFocus.current
        if (!id || !seasons.length) return
        seasons.forEach((season, row) => {
            const col = season.episodes.findIndex((episode) => episode.id === id)
            if (col >= 0) {
                setZone('seasons')
                setCell({ row, col })
            }
        })
        pendingFocus.current = null
    }, [seasons])

    const rows = useMemo<RowModel<SeasonItem>[]>(
        () =>
            seasons.map((season) => {
                const watched = season.episodes.filter((episode) => episode.isPlayed).length
                return {
                    key: `season-${season.number}`,
                    title: season.number === 0 ? t('series_specials') : t('series_season', season.number),
                    hint: (
                        <span class="body-small muted">
                            {season.number === 0
                                ? plural('series_episode_count', season.episodes.length, season.episodes.length)
                                : t('series_season_watched', watched, season.episodes.length)}
                        </span>
                    ),
                    items: [...season.episodes, { kind: 'markSeason' as const, id: `mark-${season.number}`, season }],
                }
            }),
        [seasons],
    )

    const focusedEpisode = zone === 'seasons' ? (rows[cell.row]?.items[cell.col] as SeasonItem | undefined) : undefined
    const restedEpisode = useRested(focusedEpisode && focusedEpisode.kind === 'episode' ? focusedEpisode : null, restMs)
    useEffect(() => {
        if (restedEpisode) library.warmUp(restedEpisode.id)
    }, [restedEpisode?.id])

    const write = async (target: string, played: boolean, local: (list: Episode[]) => Episode[]) => {
        if (!episodes) return
        setEpisodes(local(episodes))
        pendingWrites.current++
        try {
            await library.setPlayed(target, played)
        } catch {
            // The reload below shows the server's state.
        } finally {
            pendingWrites.current--
            if (pendingWrites.current === 0) load()
        }
    }
    const markNext = () => markableNext && write(markableNext.id, true, (list) => withPlayed(list, (episode) => episode.id === markableNext.id, true))
    const toggleSeries = () => write(seriesId, !isWatched, (list) => withPlayed(list, () => true, !isWatched))
    const toggleSeason = (season: Season) => {
        const played = !season.episodes.every((episode) => episode.isPlayed)
        const ids = new Set(season.episodes.map((episode) => episode.id))
        if (season.id) return write(season.id, played, (list) => withPlayed(list, (episode) => ids.has(episode.id), played))
        // Specials have no season id: mark each episode.
        season.episodes.forEach((episode) => void write(episode.id, played, (list) => withPlayed(list, (item) => item.id === episode.id, played)))
    }
    const play = (episode: Episode) => navigator.push({ name: 'player', itemId: episode.id, fromStart: episode.isPlayed })

    const activateTop = (button: TopButton) => {
        if (button === 'continue') next && navigator.push({ name: 'player', itemId: next.id })
        else if (button === 'markNext') void markNext()
        else void toggleSeries()
    }
    const activateCell = (item: SeasonItem) => (item.kind === 'markSeason' ? void toggleSeason(item.season) : play(item))

    useKeyLayer((key) => {
        if (failed && !seasons.length) {
            if (key === 'enter') load()
            else if (key === 'back') navigator.back()
            return true
        }
        if (zone === 'top') {
            const index = topButtons.indexOf(topButton)
            if (key === 'left' || key === 'right') {
                const nextButton = topButtons[index + (key === 'left' ? -1 : 1)]
                if (nextButton) setTopButton(nextButton)
            } else if (key === 'down') {
                if (rows.length) {
                    setZone('seasons')
                    setCell({ row: 0, col: 0 })
                }
            } else if (key === 'enter') {
                activateTop(topButton)
            } else if (key === 'back') {
                if (topButton !== 'continue') setTopButton('continue')
                else navigator.back()
            } else return key === 'up'
            return true
        }
        const row = rows[cell.row]
        switch (key) {
            case 'left':
            case 'right': {
                const col = cell.col + (key === 'left' ? -1 : 1)
                if (col >= 0 && col < row.items.length) setCell({ row: cell.row, col })
                return true
            }
            case 'down':
                if (cell.row < rows.length - 1) setCell({ row: cell.row + 1, col: 0 })
                return true
            case 'up':
                if (cell.row > 0) setCell({ row: cell.row - 1, col: 0 })
                else setZone('top')
                return true
            case 'enter':
                activateCell(row.items[cell.col])
                return true
            case 'back':
                setZone('top')
                setTopButton('continue')
                setCell({ row: 0, col: 0 })
                return true
            default:
                return false
        }
    })

    const renderItem = useCallback(
        (item: SeasonItem, isFocused: boolean, row: number, col: number) => {
            const hover = () => {
                setZone('seasons')
                setCell({ row, col })
            }
            if (item.kind === 'markSeason') {
                const all = item.season.episodes.every((episode) => episode.isPlayed)
                return <MarkSeasonCard key={item.id} watched={all} focused={isFocused} onHover={hover} onClick={() => toggleSeason(item.season)} />
            }
            return <EpisodeCard key={item.id} episode={item} focused={isFocused} onHover={hover} onClick={() => play(item)} />
        },
        [episodes],
    )

    const shown = restedEpisode ?? null
    const backdrop = series ? pickBackdrop(series.id, series.artwork.backdrops, series.artwork.backdrop) : null
    const left = next ? remainingMs(next.resumePositionMs, next.runtimeMs) : null
    const code = next ? episodeCode(next.seasonNumber, next.episodeNumber) : ''
    const continueLabel = t(isUnstarted ? 'series_play' : 'series_continue')
    const showSkeleton = useDelayedVisible(!episodes && !failed)

    return (
        <div class="series-page">
            <CornerBackdrop url={backdrop} />
            <div class="series-top">
                <div class="series-hero-logo">
                    {series?.artwork.logo ? (
                        <ArtworkImage key={series.artwork.logo} url={series.artwork.logo} fadeMs={200} fit="contain" />
                    ) : (
                        <div class="headline-small ellipsis">{series?.title ?? ''}</div>
                    )}
                </div>
                <div class="series-hero-meta">
                    {shown ? (
                        <>
                            <span class="title-small bold accent">{episodeCode(shown.seasonNumber, shown.episodeNumber)}</span>
                            <span class="title-small ellipsis">{shown.title}</span>
                            {episodeTime(shown) && <span class="body-medium muted">{`·  ${episodeTime(shown)}`}</span>}
                        </>
                    ) : (
                        series && <span class="body-medium muted ellipsis">{seriesMetaParts(series).join(separator)}</span>
                    )}
                </div>
                <div class="series-page-overview body-medium muted clamp-3">{(shown ? shown.overview : series?.overview) ?? ''}</div>
                <div class="series-top-buttons">
                    <div class="continue-slot">
                        <PillButton
                            label={code ? `${continueLabel} · ${code}` : continueLabel}
                            icon="play"
                            primary={zone === 'top' && topButton === 'continue'}
                            disabled={!next}
                            trailing={left !== null ? remainingText(left) : null}
                            focused={zone === 'top' && topButton === 'continue'}
                            onHover={() => setTopButton('continue')}
                            onClick={() => activateTop('continue')}
                        />
                    </div>
                    {markableNext && (
                        <PillButton
                            label={t('series_mark_episode', episodeCode(markableNext.seasonNumber, markableNext.episodeNumber))}
                            focused={zone === 'top' && topButton === 'markNext'}
                            onHover={() => setTopButton('markNext')}
                            onClick={() => activateTop('markNext')}
                        />
                    )}
                    <PillButton
                        label={t(isWatched ? 'series_watched' : 'series_mark_series')}
                        icon={isWatched ? 'check' : undefined}
                        focused={zone === 'top' && topButton === 'series'}
                        onHover={() => setTopButton('series')}
                        onClick={() => activateTop('series')}
                    />
                </div>
            </div>
            <div class="series-seasons">
                {failed && !seasons.length ? (
                    <div class="series-page-error">
                        <ErrorState message={t('library_error')} focused onRetry={load} />
                    </div>
                ) : rows.length ? (
                    <Rows
                        rows={rows}
                        focusedRow={cell.row}
                        focusedCol={cell.col}
                        active={zone === 'seasons'}
                        itemWidth={() => 196}
                        rowHeight={() => rowHeight}
                        headerHeight={headerHeight}
                        cardTop={cardTop}
                        renderItem={renderItem}
                    />
                ) : (
                    showSkeleton && <SeasonsSkeleton />
                )}
            </div>
        </div>
    )
}

const EpisodeCard = memo(function EpisodeCard({ episode, focused, onHover, onClick }: { episode: Episode; focused: boolean; onHover: () => void; onClick: () => void }) {
    const progress = episode.isPlayed ? null : progressOf(episode.resumePositionMs, episode.runtimeMs)
    return (
        <div class="landscape-item">
            <div class={`card landscape neon scale-105 ${focused ? 'focused' : ''} ${episode.isPlayed ? 'watched' : ''}`} onMouseEnter={onHover} onClick={onClick}>
                {episode.stillUrl && <ArtworkImage url={episode.stillUrl} fadeMs={100} />}
                {episode.isPlayed && (
                    <span class="watched-check">
                        <Icon name="check" size={12} />
                    </span>
                )}
                {progress !== null && <ProgressBar progress={progress} class="card-progress" />}
                {focused && <NeonEffect mode="halo" />}
            </div>
            <div class="landscape-label label-medium muted ellipsis">{`${episode.episodeNumber ?? ''}  ·  ${episode.title}`}</div>
        </div>
    )
})

function MarkSeasonCard({ watched, focused, onHover, onClick }: { watched: boolean; focused: boolean; onHover: () => void; onClick: () => void }) {
    return (
        <div class="landscape-item">
            <div class={`card landscape mark-season neon scale-105 ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
                {watched && <Icon name="check" size={20} />}
                <span class="label-large clamp-2">{t(watched ? 'series_season_all_watched' : 'series_mark_season')}</span>
                {focused && <NeonEffect mode="halo" />}
            </div>
        </div>
    )
}

function SeasonsSkeleton() {
    return (
        <div class="seasons-skeleton">
            {[0, 1].map((row) => (
                <div class="seasons-skeleton-row">
                    <SkeletonBlock width={120} height={20} index={row * 6} radius={4} />
                    <div class="seasons-skeleton-cards">
                        {[0, 1, 2, 3, 4].map((col) => (
                            <div>
                                <SkeletonBlock width={196} height={110} index={row * 6 + col + 1} />
                                <SkeletonBlock width={110} height={12} index={row * 6 + col + 1} top={12} radius={4} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
