import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { pickBackdrop } from '../../core/data/backdrops'
import { useLoad } from '../../core/data/useLoad'
import { FullBackdrop } from '../../core/design/components/Backdrops'
import { PillButton } from '../../core/design/components/Buttons'
import { ErrorState } from '../../core/design/components/Common'
import { MovieInfo, MovieInfoSkeleton, MovieTechLine } from '../../core/design/components/MovieInfo'
import { useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { remainingMs, type Movie } from '../../core/model/library'
import { useIsActiveScreen, useNavigator } from '../../core/navigation/Navigator'
import type { PlaybackTech } from '../../core/playback/tech'
import { remainingText } from '../../core/ui/format'
import './detail.css'

type Button = 'play' | 'start' | 'watched'

export function MovieDetailScreen({ movieId }: { movieId: string }) {
    const { library, playback } = useApp()
    const navigator = useNavigator()
    const active = useIsActiveScreen()
    const cached = library.peekMovie(movieId)
    const { state, retry, setData } = useLoad<Movie>(
        `movie-${movieId}`,
        async () => {
            const movie = await library.getMovie(movieId)
            if (!movie) throw new Error('not found')
            return movie
        },
        active,
    )
    const movie = state.kind === 'ready' ? state.data : cached
    const [focused, setFocused] = useState<Button>('play')
    const [tech, setTech] = useState<PlaybackTech | null>(null)

    useEffect(() => {
        if (cached && state.kind === 'loading') setData(cached)
        library.warmUp(movieId)
        playback.techFor(movieId).then(setTech)
    }, [])

    const buttons: Button[] = movie ? ['play', ...(movie.resumePositionMs > 0 ? (['start'] as const) : []), 'watched'] : ['play']
    useEffect(() => {
        if (!buttons.includes(focused)) setFocused('play')
    }, [buttons.join()])

    const setWatched = async (played: boolean) => {
        if (!movie) return
        setData({ ...movie, isPlayed: played, resumePositionMs: 0 })
        try {
            await library.setPlayed(movie.id, played)
        } catch {
            setData(movie)
        }
    }
    const activate = (button: Button) => {
        if (!movie) return
        if (button === 'play') navigator.push({ name: 'player', itemId: movie.id })
        else if (button === 'start') navigator.push({ name: 'player', itemId: movie.id, fromStart: true })
        else void setWatched(!movie.isPlayed)
    }

    useKeyLayer((key) => {
        if (!movie && state.kind === 'error') {
            if (key === 'enter') retry()
            else if (key === 'back') navigator.back()
            return true
        }
        const index = buttons.indexOf(focused)
        if (key === 'left' || key === 'right') {
            const next = buttons[index + (key === 'left' ? -1 : 1)]
            if (next) setFocused(next)
        } else if (key === 'enter') {
            activate(focused)
        } else if (key === 'back') {
            if (focused !== 'play') setFocused('play')
            else navigator.back()
        } else {
            return false
        }
        return true
    })

    const showSkeleton = useDelayedVisible(!movie && state.kind === 'loading')
    const left = movie ? remainingMs(movie.resumePositionMs, movie.runtimeMs) : null
    return (
        <div class="movie-detail">
            <FullBackdrop url={movie ? pickBackdrop(movie.id, movie.artwork.backdrops, movie.artwork.backdrop) : null} />
            <div class="movie-detail-column">
                {movie ? (
                    <MovieInfo movie={movie} overviewLines={8} />
                ) : state.kind === 'error' ? (
                    <div class="movie-detail-placeholder">
                        <ErrorState message={t('library_error')} focused onRetry={retry} />
                    </div>
                ) : (
                    <div class="movie-detail-placeholder">{showSkeleton && <MovieInfoSkeleton />}</div>
                )}
                <div class="movie-detail-buttons">
                    <PillButton
                        label={t(movie && movie.resumePositionMs > 0 ? 'detail_resume' : 'detail_play')}
                        icon="play"
                        primary
                        disabled={!movie}
                        trailing={left !== null ? remainingText(left) : null}
                        focused={focused === 'play'}
                        onHover={() => setFocused('play')}
                        onClick={() => activate('play')}
                    />
                    {movie && movie.resumePositionMs > 0 && (
                        <PillButton label={t('detail_from_start')} icon="restart" focused={focused === 'start'} onHover={() => setFocused('start')} onClick={() => activate('start')} />
                    )}
                    {movie && (
                        <PillButton
                            label={t(movie.isPlayed ? 'detail_watched' : 'detail_mark_watched')}
                            icon={movie.isPlayed ? 'check' : undefined}
                            focused={focused === 'watched'}
                            onHover={() => setFocused('watched')}
                            onClick={() => activate('watched')}
                        />
                    )}
                </div>
                {movie && <MovieTechLine movie={movie} tech={tech} />}
            </div>
        </div>
    )
}
