import { memo } from 'preact/compat'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { advanceBackdrops, pickBackdrop } from '../../core/data/backdrops'
import { homeStackSize, rankHome, type Candidate } from '../../core/data/homeRanking'
import { useLoad } from '../../core/data/useLoad'
import { FullBackdrop } from '../../core/design/components/Backdrops'
import { PillButton } from '../../core/design/components/Buttons'
import { ErrorState, StackNeighbours } from '../../core/design/components/Common'
import { SkeletonBlock, useDelayedVisible } from '../../core/design/components/Skeleton'
import { useKeyLayer, useRested } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import type { Series } from '../../core/model/library'
import { useNavigator } from '../../core/navigation/Navigator'
import { SuggestionDetails, SuggestionTechLine } from './SuggestionDetails'
import type { SectionProps } from './sectionProps'
import './home.css'

export interface Suggestion extends Candidate {
    series: Series | null
}

const restMs = 300

export const HomeSection = memo(function HomeSection({ focused, visible, resetKey }: SectionProps) {
    const { library } = useApp()
    const navigator = useNavigator()
    const [index, setIndex] = useState(0)
    const playing = useRef(false)

    const { state, retry } = useLoad<Suggestion[]>(
        'home',
        async () => {
            const [nextUp, resume, latest, random] = await Promise.all([
                library.getNextUp(),
                library.getResumeMovies(homeStackSize),
                library.getLatestUnwatchedMovies(homeStackSize),
                library.getRandomUnwatchedMovie().catch(() => null),
            ])
            const candidates = rankHome(nextUp, resume, latest, random, Date.now())
            return Promise.all(
                candidates.map(async (candidate) => {
                    if (candidate.item.kind !== 'episode') return { ...candidate, series: null }
                    const seriesId = candidate.item.seriesId
                    const series = library.peekSeries(seriesId) ?? (await library.getSeriesById(seriesId))
                    if (!series) throw new Error('series missing')
                    return { ...candidate, series }
                }),
            )
        },
        visible,
    )
    const stack = state.kind === 'ready' ? state.data : []
    const current = stack[Math.min(index, stack.length - 1)] ?? null

    useEffect(() => setIndex(0), [resetKey])
    useEffect(() => {
        if (visible) {
            playing.current = false
            return
        }
        if (!playing.current) setIndex(0)
        advanceBackdrops(stack.map(ownerOf))
    }, [visible])

    const rested = useRested(current, restMs)
    useEffect(() => {
        if (rested && visible) library.warmUp(rested.item.id)
    }, [rested, visible])

    const play = () => {
        if (!current) return
        playing.current = true
        navigator.push({ name: 'player', itemId: current.item.id })
    }

    useKeyLayer((key) => {
        if (!focused) return false
        if (key === 'left' || key === 'right') {
            const next = index + (key === 'left' ? -1 : 1)
            if (next >= 0 && next < stack.length) setIndex(next)
            return true
        }
        if (key === 'enter') {
            if (state.kind === 'error') retry()
            else play()
            return true
        }
        return false
    })

    const showSkeleton = useDelayedVisible(state.kind === 'loading')
    const backdropItem = rested ?? current
    const backdrop = backdropItem ? pickBackdrop(ownerOf(backdropItem), backdropItem.item.artwork.backdrops, backdropItem.item.artwork.backdrop) : null
    const resume = current ? current.item.resumePositionMs > 0 : false

    return (
        <div class="home-section">
            <FullBackdrop url={backdrop} />
            <div class="home-column">
                {state.kind === 'error' ? (
                    <ErrorState message={t('library_error')} focused={focused} onRetry={retry} />
                ) : current ? (
                    <>
                        <SuggestionDetails suggestion={current} />
                        <div class="home-play">
                            <PillButton label={t(resume ? 'home_resume' : 'home_play')} icon="play" primary focused={focused} onClick={play} />
                        </div>
                        <SuggestionTechLine suggestion={current} />
                    </>
                ) : state.kind === 'ready' ? (
                    <div class="body-medium muted home-empty">{t('home_empty')}</div>
                ) : (
                    <>
                        {showSkeleton && <HomeSkeleton />}
                        <div class="home-play" style={{ marginTop: showSkeleton ? '18px' : '248px' }}>
                            <PillButton label={t('home_play')} icon="play" primary disabled focused={focused} />
                        </div>
                    </>
                )}
            </div>
            {stack.length > 1 && (
                <StackNeighbours
                    previous={index > 0 ? titleOf(stack[index - 1]) : null}
                    next={index < stack.length - 1 ? titleOf(stack[index + 1]) : null}
                    position={index + 1}
                    count={stack.length}
                />
            )}
        </div>
    )
})

function ownerOf(suggestion: Suggestion): string {
    return suggestion.item.kind === 'episode' ? suggestion.item.seriesId : suggestion.item.id
}

function titleOf(suggestion: Suggestion): string {
    return suggestion.series?.title ?? suggestion.item.title
}

function HomeSkeleton() {
    return (
        <div class="home-skeleton">
            <SkeletonBlock width={180} height={95} index={0} />
            <SkeletonBlock width={260} height={18} index={1} top={16} radius={4} />
            <SkeletonBlock width={400} height={15} index={2} top={6} radius={4} />
            <SkeletonBlock width={380} height={15} index={3} top={6} radius={4} />
            <SkeletonBlock width={240} height={15} index={4} top={6} radius={4} />
        </div>
    )
}
