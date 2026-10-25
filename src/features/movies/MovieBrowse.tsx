import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { FullBackdrop } from '../../core/design/components/Backdrops'
import { HoldOkHint, PillButton } from '../../core/design/components/Buttons'
import { ErrorState, StackNeighbours } from '../../core/design/components/Common'
import { MovieInfo, MovieInfoSkeleton, MovieTechLine } from '../../core/design/components/MovieInfo'
import { OptionsPanel, type Option } from '../../core/design/components/OptionsPanel'
import { useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer, useRested } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { remainingMs, type Movie } from '../../core/model/library'
import type { PlaybackTech } from '../../core/playback/tech'
import { remainingText } from '../../core/ui/format'
import type { MovieViewProps } from './MoviesSection'
import './movies.css'

const restMs = 300

/** One movie per screen: ←/→ pages within the shelf, ↑/↓ changes shelf; OK plays, holding OK opens options. */
export function MovieBrowse({ shelves, position, loading, error, focused, visible, onMove, onRetry, onPlay, onWatched, backdropOf }: MovieViewProps) {
    const { library, playback } = useApp()
    const shelf = shelves[position.shelf]
    const movie = shelf?.items[position.index] ?? null
    const settled = useRested(movie?.id ?? null, restMs)
    const isSettled = movie !== null && settled === movie.id
    const [tech, setTech] = useState<{ id: string; tech: PlaybackTech | null } | null>(null)
    const [options, setOptions] = useState(false)
    const [fullOverview, setFullOverview] = useState(false)

    useEffect(() => setFullOverview(false), [movie?.id])
    useEffect(() => {
        if (!isSettled || !movie || !visible) return
        library.warmUp(movie.id)
        let current = true
        playback.techFor(movie.id).then((result) => current && setTech({ id: movie.id, tech: result }))
        return () => {
            current = false
        }
    }, [isSettled, movie?.id, visible])

    useKeyLayer(
        (key) => {
            if (!focused || options) return false
            if (error) {
                if (key === 'enter') onRetry()
                return key === 'enter'
            }
            if (!shelf) return key !== 'up' && key !== 'back'
            switch (key) {
                case 'left':
                case 'right': {
                    const index = position.index + (key === 'left' ? -1 : 1)
                    if (index >= 0 && index < shelf.items.length) onMove({ shelf: position.shelf, index })
                    return true
                }
                case 'down':
                    if (position.shelf < shelves.length - 1) onMove({ shelf: position.shelf + 1, index: 0 })
                    return true
                case 'up':
                    if (position.shelf === 0) return false
                    onMove({ shelf: position.shelf - 1, index: 0 })
                    return true
                case 'enter':
                    if (movie) onPlay(movie, false)
                    return true
                case 'longEnter':
                    if (movie) setOptions(true)
                    return true
                default:
                    return false
            }
        },
        () => focused && !options && movie !== null,
    )

    const showSkeleton = useDelayedVisible(loading)
    const left = movie ? remainingMs(movie.resumePositionMs, movie.runtimeMs) : null
    const movieOptions = (target: Movie): Option[] => {
        const close = (action: () => void) => () => {
            setOptions(false)
            action()
        }
        const list: Option[] = []
        if (target.resumePositionMs > 0) list.push({ key: 'start', label: t('detail_from_start'), onSelect: close(() => onPlay(target, true)) })
        if (!target.isPlayed) list.push({ key: 'watched', label: t('detail_mark_watched'), onSelect: close(() => onWatched(target, true)) })
        if (target.isPlayed || target.resumePositionMs > 0) {
            list.push({ key: 'unwatched', label: t('movies_mark_unwatched'), onSelect: close(() => onWatched(target, false)) })
        }
        list.push({ key: 'overview', label: t('movies_full_overview'), dividerBefore: true, onSelect: close(() => setFullOverview(true)) })
        return list
    }

    return (
        <div class="movie-browse">
            <FullBackdrop url={movie && isSettled ? backdropOf(movie) : null} baseColor={movie?.spine.darkColor} />
            <div class="movie-browse-column">
                {error ? (
                    <ErrorState message={t('library_error')} focused={focused} onRetry={onRetry} />
                ) : movie ? (
                    <>
                        <MovieInfo movie={movie} overviewLines={fullOverview ? 8 : 3} showOverview={isSettled} />
                        <div class="movie-actions">
                            <PillButton
                                label={t(movie.resumePositionMs > 0 ? 'movies_resume' : 'movies_play')}
                                icon="play"
                                primary
                                trailing={left !== null ? remainingText(left) : null}
                                focused={focused}
                                onClick={() => onPlay(movie, false)}
                            />
                            <HoldOkHint label={t('movies_hold_ok')} />
                        </div>
                        <MovieTechLine movie={movie} tech={tech?.id === movie.id ? tech.tech : null} visible={isSettled} />
                    </>
                ) : (
                    showSkeleton && (
                        <>
                            <MovieInfoSkeleton />
                            <div class="movie-actions">
                                <PillButton label={t('movies_play')} icon="play" primary disabled focused={focused} />
                            </div>
                        </>
                    )
                )}
            </div>
            {shelf && shelf.items.length > 1 && (
                <StackNeighbours
                    previous={shelf.items[position.index - 1]?.title ?? null}
                    next={shelf.items[position.index + 1]?.title ?? null}
                    position={position.index + 1}
                    count={shelf.items.length}
                />
            )}
            {options && movie && <OptionsPanel title={movie.title} options={movieOptions(movie)} onClose={() => setOptions(false)} />}
        </div>
    )
}
