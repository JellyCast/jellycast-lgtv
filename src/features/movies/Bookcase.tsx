import { useEffect, useState } from 'preact/hooks'
import { memo } from 'preact/compat'
import { ArtworkImage } from '../../core/design/components/Artwork'
import { ErrorState } from '../../core/design/components/Common'
import { Icon } from '../../core/design/components/Icon'
import { NeonEffect } from '../../core/design/components/NeonEffect'
import { SkeletonBlock, useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer, useRested } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { progressOf, remainingMs, type Movie } from '../../core/model/library'
import { dynamicRangeShortLabel, movieMetaParts, remainingText, resolutionLabel, separator } from '../../core/ui/format'
import { shelfTitle, type MovieViewProps } from './MoviesSection'
import './bookcase.css'

const spineStep = 48
const panelOffset = 124
const panelWidth = 500
const restMs = 300

type PanelButton = 'play' | 'details'

/**
 * Movies as a DVD bookcase: vertical spines with the focused movie opened as a 500 dp panel at a fixed
 * place. ↓ goes Watch → Details → next shelf; ↑ the other way, then to the section bar.
 */
export function Bookcase({ shelves, position, loading, error, focused, resetKey, onMove, onRetry, onPlay, onDetails, backdropOf }: MovieViewProps) {
    const shelf = shelves[position.shelf]
    const movie = shelf?.items[position.index] ?? null
    const [button, setButton] = useState<PanelButton>('play')
    const settled = useRested(movie?.id ?? null, restMs)
    useEffect(() => setButton('play'), [position.shelf, resetKey])

    useKeyLayer((key) => {
        if (!focused) return false
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
                if (button === 'play') setButton('details')
                else if (position.shelf < shelves.length - 1) onMove({ shelf: position.shelf + 1, index: 0 })
                return true
            case 'up':
                if (button === 'details') setButton('play')
                else if (position.shelf > 0) {
                    onMove({ shelf: position.shelf - 1, index: 0 })
                    setButton('details')
                } else return false
                return true
            case 'enter':
                if (movie) {
                    if (button === 'play') onPlay(movie, false)
                    else onDetails(movie)
                }
                return true
            default:
                return false
        }
    })

    const showSkeleton = useDelayedVisible(loading)
    if (error) {
        return (
            <div class="bookcase-error">
                <ErrorState message={t('library_error')} focused={focused} onRetry={onRetry} />
            </div>
        )
    }
    if (!shelf) return showSkeleton ? <BookcaseSkeleton /> : null

    const scroll = Math.max(0, position.index * spineStep - panelOffset)
    const isContinue = shelf.kind.type === 'continue'
    const nextShelf = shelves[position.shelf + 1]
    const hiddenLeft = scroll > 0
    const hiddenRight = 48 + (shelf.items.length - 1) * spineStep + panelWidth - scroll > 960
    return (
        <div class="bookcase">
            <div class="bookcase-row" style={{ transform: `translateX(${-scroll}px)` }}>
                {shelf.items.map((item, index) =>
                    index === position.index ? (
                        <MoviePanel
                            key={item.id}
                            movie={item}
                            settled={settled === item.id}
                            backdrop={settled === item.id ? backdropOf(item) : null}
                            button={focused ? button : null}
                            onPlay={() => onPlay(item, false)}
                            onDetails={() => onDetails(item)}
                        />
                    ) : (
                        <MovieSpine key={item.id} movie={item} showProgress={isContinue} onClick={() => onMove({ shelf: position.shelf, index })} />
                    ),
                )}
                {nextShelf && (
                    <div class="next-shelf-hint">
                        <span class="label-medium heading muted">{t('movies_next_shelf')}</span>
                        <span class="next-shelf-name title-medium">
                            <Icon name="arrowDown" size={16} />
                            {shelfTitle(nextShelf)}
                        </span>
                    </div>
                )}
            </div>
            {hiddenLeft && (
                <div class="bookcase-edge left">
                    <Icon name="chevronLeft" size={24} class="muted" />
                </div>
            )}
            {hiddenRight && (
                <div class="bookcase-edge right">
                    <Icon name="chevronRight" size={24} class="muted" />
                </div>
            )}
        </div>
    )
}

/** 44×431: poster on top, the logo rotated (reading bottom to top), resolution, HDR or Atmos and age rating. */
const MovieSpine = memo(function MovieSpine({ movie, showProgress, onClick }: { movie: Movie; showProgress: boolean; onClick: () => void }) {
    const { spine, tech } = movie
    const progress = showProgress ? progressOf(movie.resumePositionMs, movie.runtimeMs) : null
    const range = tech.dynamicRange ? dynamicRangeShortLabel(tech.dynamicRange) : tech.hasAtmos ? t('tech_atmos') : null
    return (
        <div class={`spine ${spine.isLight ? 'light' : ''}`} style={{ background: spine.color }} onClick={onClick}>
            <div class="spine-poster">{spine.posterUrl && <ArtworkImage url={spine.posterUrl} fadeMs={100} />}</div>
            <div class="spine-logo">
                <div class="spine-logo-rotated">
                    {spine.logoUrl ? <ArtworkImage url={spine.logoUrl} fadeMs={100} fit="contain" /> : <span class="label-medium bold clamp-2">{movie.title}</span>}
                </div>
            </div>
            <div class="spine-bottom">
                {tech.resolution && <span class="label-medium spine-resolution">{resolutionLabel(tech.resolution)}</span>}
                {range && <span class="label-small spine-muted">{range}</span>}
                {movie.ageRating && (
                    <>
                        <span class="spine-line" />
                        <span class="spine-rating label-small">{movie.ageRating}</span>
                    </>
                )}
            </div>
            {progress !== null && <span class="spine-progress" style={{ height: `${progress * 100}%` }} />}
        </div>
    )
})

interface PanelProps {
    movie: Movie
    settled: boolean
    backdrop: string | null
    button: PanelButton | null
    onPlay: () => void
    onDetails: () => void
}

function MoviePanel({ movie, settled, backdrop, button, onPlay, onDetails }: PanelProps) {
    const { spine } = movie
    const left = remainingMs(movie.resumePositionMs, movie.runtimeMs)
    const progress = progressOf(movie.resumePositionMs, movie.runtimeMs)
    return (
        <div class={`movie-panel ${spine.isLight ? 'light' : ''}`} style={{ background: spine.color }}>
            {settled && backdrop && (
                <>
                    <ArtworkImage key={backdrop} url={backdrop} fadeMs={200} />
                    <div
                        class="movie-panel-scrim"
                        style={{
                            background: `linear-gradient(180deg, ${spine.color}00 25%, ${spine.color}d9 58%, ${spine.color} 78%)`,
                        }}
                    />
                </>
            )}
            <div class="movie-panel-content">
                <div class="movie-panel-title">
                    {movie.artwork.logo ? (
                        <ArtworkImage key={movie.artwork.logo} url={movie.artwork.logo} fadeMs={200} fit="contain" />
                    ) : (
                        <span class="headline-small clamp-2">{movie.title}</span>
                    )}
                </div>
                <div class="movie-panel-meta" style={{ height: progress !== null ? '34px' : '21px' }}>
                    <div class="movie-panel-meta-line">
                        {left !== null && <span class="title-small bold accent">{remainingText(left)}</span>}
                        <span class="body-medium spine-muted ellipsis">{[movie.year, ...movieMetaParts(movie)].filter(Boolean).join(separator)}</span>
                    </div>
                    {progress !== null && (
                        <div class="movie-panel-progress">
                            <div class="progress-fill" style={{ transform: `scaleX(${progress})`, transformOrigin: 'left' }} />
                        </div>
                    )}
                </div>
                <div class="movie-panel-buttons">
                    <PanelPill label={t(movie.resumePositionMs > 0 ? 'movies_resume' : 'movies_play')} icon selected={button === 'play'} onClick={onPlay} />
                    <PanelPill label={t('movies_details')} selected={button === 'details'} onClick={onDetails} />
                </div>
            </div>
        </div>
    )
}

function PanelPill({ label, icon, selected, onClick }: { label: string; icon?: boolean; selected: boolean; onClick: () => void }) {
    return (
        <div class={`panel-pill neon ${selected ? 'focused selected' : ''}`} onClick={onClick}>
            {icon && <Icon name="play" size={16} />}
            <span class="title-small bold">{label}</span>
            {selected && <NeonEffect mode="comet" />}
        </div>
    )
}

function BookcaseSkeleton() {
    return (
        <div class="bookcase">
            <div class="bookcase-row">
                <SkeletonBlock width={panelWidth} height={431} index={0} radius={0} />
                {Array.from({ length: 9 }, (_, index) => (
                    <SkeletonBlock width={44} height={431} index={index + 1} radius={0} />
                ))}
            </div>
        </div>
    )
}
