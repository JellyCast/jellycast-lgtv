import { memo } from 'preact/compat'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { advanceBackdrops, pickBackdrop } from '../../core/data/backdrops'
import { seriesShelves, type SeriesShelfItem, type Shelf } from '../../core/data/shelves'
import { useLoad } from '../../core/data/useLoad'
import { CornerBackdrop } from '../../core/design/components/Backdrops'
import { HoldOkHint } from '../../core/design/components/Buttons'
import { LandscapeCard, PosterCard } from '../../core/design/components/Cards'
import { ErrorState } from '../../core/design/components/Common'
import { OptionsPanel } from '../../core/design/components/OptionsPanel'
import { Rows, type RowModel } from '../../core/design/components/Rows'
import { useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer, useRested } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { progressOf, type Episode } from '../../core/model/library'
import { useNavigator } from '../../core/navigation/Navigator'
import { episodeCode } from '../../core/ui/format'
import type { SectionProps } from '../home/sectionProps'
import { SeriesHero, SeriesSkeleton } from './SeriesHero'

const restMs = 300
const landscapeRowHeight = 138
const posterRowHeight = 180
const headerHeight = 32
const cardTop = 74

function shelfTitle(shelf: Shelf<SeriesShelfItem>): string {
    switch (shelf.kind.type) {
        case 'continue':
            return t('shelf_continue')
        case 'new':
            return t('series_shelf_new')
        case 'notStarted':
            return t('series_shelf_not_started')
        case 'genre':
            return shelf.kind.name
    }
}

function ownerOf(item: SeriesShelfItem): string {
    return item.kind === 'episode' ? item.seriesId : item.id
}

export const SeriesSection = memo(function SeriesSection({ focused, visible, resetKey }: SectionProps) {
    const { library } = useApp()
    const navigator = useNavigator()
    const [focus, setFocus] = useState({ row: 0, col: 0 })
    const [options, setOptions] = useState<Episode | null>(null)
    const { state, retry, reload } = useLoad(
        'series',
        async () => {
            const [series, nextUp] = await Promise.all([library.getSeries(), library.getNextUp()])
            return seriesShelves(series, nextUp, Date.now())
        },
        visible,
    )
    const shelves = state.kind === 'ready' ? state.data : []
    const rows = useMemo<RowModel<SeriesShelfItem>[]>(
        () =>
            shelves.map((shelf) => ({
                key: shelf.key,
                title: shelfTitle(shelf),
                items: shelf.items,
                hint: shelf.kind.type === 'continue' ? <HoldOkHint label={t('movies_hold_ok')} /> : undefined,
            })),
        [shelves],
    )
    const lastFocusedId = useRef<string | null>(null)

    useEffect(() => setFocus({ row: 0, col: 0 }), [resetKey])
    useEffect(() => {
        if (!visible) advanceBackdrops(shelves.flatMap((shelf) => shelf.items.map(ownerOf)))
    }, [visible])
    // Data arriving later never moves the focus: keep it on the same item, or clamp it.
    useEffect(() => {
        if (!rows.length) return
        const id = lastFocusedId.current
        for (let row = 0; id && row < rows.length; row++) {
            const col = rows[row].items.findIndex((item) => item.id === id)
            if (col >= 0) {
                setFocus({ row, col })
                return
            }
        }
        setFocus((current) => {
            const row = Math.min(current.row, rows.length - 1)
            return { row, col: Math.min(current.col, rows[row].items.length - 1) }
        })
    }, [rows])

    const focusedItem = rows[focus.row]?.items[focus.col] ?? null
    lastFocusedId.current = focusedItem?.id ?? lastFocusedId.current
    const hero = useRested(focusedItem, restMs)
    useEffect(() => {
        if (!hero || !visible) return
        if (hero.kind === 'series' && !library.peekEpisodes(hero.id)) library.getEpisodes(hero.id).catch(() => undefined)
        if (hero.kind === 'episode') library.warmUp(hero.id)
    }, [hero, visible])

    const open = useCallback((item: SeriesShelfItem) => {
        if (item.kind === 'episode') navigator.push({ name: 'player', itemId: item.id })
        else navigator.push({ name: 'series', seriesId: item.id })
    }, [])

    useKeyLayer(
        (key) => {
            if (!focused || options) return false
            if (state.kind === 'error') {
                if (key === 'enter') retry()
                return key === 'enter'
            }
            const row = rows[focus.row]
            if (!row) return false
            switch (key) {
                case 'left':
                case 'right': {
                    const col = focus.col + (key === 'left' ? -1 : 1)
                    if (col >= 0 && col < row.items.length) setFocus({ row: focus.row, col })
                    return true
                }
                case 'down':
                    if (focus.row < rows.length - 1) setFocus({ row: focus.row + 1, col: 0 })
                    return true
                case 'up':
                    if (focus.row === 0) return false
                    setFocus({ row: focus.row - 1, col: 0 })
                    return true
                case 'enter':
                    if (focusedItem) open(focusedItem)
                    return true
                case 'longEnter':
                    if (focusedItem?.kind === 'episode') setOptions(focusedItem)
                    return true
                default:
                    return false
            }
        },
        () => focused && focusedItem?.kind === 'episode',
    )

    const markWatched = async (episode: Episode, played: boolean) => {
        setOptions(null)
        await library.setPlayed(episode.id, played).catch(() => undefined)
        reload()
    }

    const renderItem = useCallback(
        (item: SeriesShelfItem, isFocused: boolean, row: number, col: number) => {
            const hover = () => setFocus({ row, col })
            if (item.kind === 'episode') {
                const code = episodeCode(item.seasonNumber, item.episodeNumber)
                return (
                    <LandscapeCard
                        key={item.id}
                        url={item.artwork.landscape}
                        title={item.seriesTitle}
                        label={item.resumePositionMs > 0 ? code : t('series_card_new', code)}
                        progress={progressOf(item.resumePositionMs, item.runtimeMs)}
                        focused={isFocused}
                        onHover={hover}
                        onClick={() => open(item)}
                    />
                )
            }
            return <PosterCard key={item.id} url={item.artwork.poster} title={item.title} focused={isFocused} onHover={hover} onClick={() => open(item)} />
        },
        [open],
    )

    const showSkeleton = useDelayedVisible(state.kind === 'loading')
    const backdropOwner = hero ?? focusedItem
    const backdrop = backdropOwner ? pickBackdrop(ownerOf(backdropOwner), backdropOwner.artwork.backdrops, backdropOwner.artwork.backdrop) : null

    return (
        <div class="series-section">
            <CornerBackdrop url={backdrop} />
            {state.kind === 'error' && (
                <div class="series-error">
                    <ErrorState message={t('library_error')} focused={focused} onRetry={retry} />
                </div>
            )}
            {state.kind === 'loading' && showSkeleton && <SeriesSkeleton />}
            {focusedItem && <SeriesHero item={hero ?? focusedItem} />}
            {rows.length > 0 && (
                <div class="series-list">
                    <Rows
                        rows={rows}
                        focusedRow={focus.row}
                        focusedCol={focus.col}
                        active={focused && !options}
                        itemWidth={(row) => (row.items[0]?.kind === 'episode' ? 196 : 120)}
                        rowHeight={(row) => (row.items[0]?.kind === 'episode' ? landscapeRowHeight : posterRowHeight)}
                        headerHeight={headerHeight}
                        cardTop={cardTop}
                        renderItem={renderItem}
                    />
                </div>
            )}
            {options && (
                <OptionsPanel
                    title={`${options.seriesTitle} · ${episodeCode(options.seasonNumber, options.episodeNumber)}`}
                    top={76}
                    onClose={() => setOptions(null)}
                    options={[
                        { key: 'watched', label: t('detail_mark_watched'), onSelect: () => markWatched(options, true) },
                        ...(options.resumePositionMs > 0
                            ? [{ key: 'unwatched', label: t('movies_mark_unwatched'), onSelect: () => markWatched(options, false) }]
                            : []),
                        {
                            key: 'series',
                            label: t('series_open_page'),
                            dividerBefore: true,
                            onSelect: () => {
                                setOptions(null)
                                navigator.push({ name: 'series', seriesId: options.seriesId, focusEpisodeId: options.id })
                            },
                        },
                    ]}
                />
            )}
        </div>
    )
})
