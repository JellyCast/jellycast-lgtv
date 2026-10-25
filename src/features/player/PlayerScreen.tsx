import { NeonEffect } from '../../core/design/components/NeonEffect'
import { useEffect, useRef, useState } from 'preact/hooks'
import { updateSettings, useSettings, type SubtitleSize } from '../../core/data/settings'
import { PillButton } from '../../core/design/components/Buttons'
import { Icon } from '../../core/design/components/Icon'
import type { IconName } from '../../core/design/icons'
import { useKeyLayer } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { nextCardStartMs, skippableAt } from '../../core/model/segments'
import { useNavigator } from '../../core/navigation/Navigator'
import { useApp } from '../../app/AppContext'
import { audioCodecName } from '../../core/playback/tech'
import { describePlan } from '../../core/playback/tech'
import type { MediaStream } from '../../core/playback/playbackInfo'
import type { RequestedStreams } from '../../core/playback/remoteControl'
import { episodeCode } from '../../core/ui/format'
import { JumpPill } from './JumpPill'
import { PlayerMenu, type MenuOption } from './PlayerMenu'
import { subtitleEntries, trackLabel, type SubtitleEntry } from './trackLabels'
import { formatClock, Timebar } from './Timebar'
import { usePlayback } from './usePlayback'
import './player.css'

type Control = 'back10' | 'playPause' | 'forward10' | 'audio' | 'subtitles' | 'info' | 'next'
type Focus = { area: 'timebar' } | { area: 'controls'; control: Control } | { area: 'pill' }

const overlayHideMs = 4000
const seekStepMs = 10_000
const longSeekStepMs = 30_000
const longSeekAfterMs = 1000
const seekCommitMs = 400
const confirmSeekWindowMs = 3000
const countdownMs = 10_000
const countdownTickMs = 100
const subtitleScale: Record<SubtitleSize, number> = { small: 0.8, normal: 1, large: 1.25 }
const skipKeys: Record<string, string> = {
    Intro: 'player_skip_intro',
    Recap: 'player_skip_recap',
    Commercial: 'player_skip_commercial',
    Preview: 'player_skip_preview',
}

function displayName(code: string, locale: string): string {
    try {
        const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code)
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : code
    } catch {
        return code
    }
}

function appLocale(): string {
    return document.documentElement.lang || 'en'
}

function languageName(code: string | undefined): string | null {
    if (!code || code === 'und') return null
    return displayName(code, appLocale())
}

/** The name in the app's language first, then in English and in the language itself. */
function languageNames(code: string): string[] {
    return [appLocale(), 'en', code].map((locale) => displayName(code, locale))
}

function subtitleLabel(entry: SubtitleEntry, index: number): string {
    const name = entry.language ?? entry.title ?? t('player_track', index + 1)
    return entry.number ? `${name} ${entry.number}` : name
}

function subtitleDetail(entry: SubtitleEntry): string {
    return [
        entry.language ? entry.title : null,
        entry.isSdh ? t('player_sdh') : null,
        entry.isForced ? t('player_forced') : null,
        entry.isImage ? t('player_subtitle_image') : null,
    ]
        .filter(Boolean)
        .join(' · ')
}

function labelFor(stream: MediaStream, siblings: MediaStream[], index: number) {
    return trackLabel(stream, siblings, languageName(stream.Language), t('player_track', index + 1))
}

function channelLabel(channels: number | undefined): string | null {
    if (!channels) return null
    if (channels === 2) return t('player_channels_stereo')
    if (channels === 6) return t('player_channels_51')
    if (channels === 8) return t('player_channels_71')
    return t('player_channels_other', channels)
}

export function PlayerScreen({
    itemId,
    fromStart,
    startMs,
    streams: requestedStreams,
}: {
    itemId: string
    fromStart?: boolean
    startMs?: number
    streams?: RequestedStreams
}) {
    const navigator = useNavigator()
    const settings = useSettings()
    const { session } = useApp()
    const player = usePlayback(itemId, !!fromStart, () => navigator.back(), startMs, requestedStreams)
    const { model } = player
    const [overlay, setOverlay] = useState(true)
    const [focus, setFocus] = useState<Focus>({ area: 'timebar' })
    const [menu, setMenu] = useState<'audio' | 'subtitles' | null>(null)
    const [info, setInfo] = useState(false)
    const [pendingSeek, setPendingSeek] = useState<number | null>(null)
    const [dismissed, setDismissed] = useState<string | null>(null)
    const [countdown, setCountdown] = useState<number | null>(null)
    const hideTimer = useRef(0)
    const seekTimer = useRef(0)
    const seekHeldSince = useRef(0)
    const lastSeekStepAt = useRef(0)

    const { item, plan, next, segments, positionMs, durationMs, paused } = model
    const skip = skippableAt(segments, positionMs)
    const nearEnd = !!next && durationMs > 0 && positionMs >= nextCardStartMs(segments, durationMs)
    const pillKey = nearEnd ? 'next' : skip ? `${skip.type}-${skip.startMs}` : null
    const pillVisible = pillKey !== null && pillKey !== dismissed

    const keepOverlay = () => {
        setOverlay(true)
        window.clearTimeout(hideTimer.current)
        if (!paused && !menu && !info && !model.settling) hideTimer.current = window.setTimeout(() => setOverlay(false), overlayHideMs)
    }
    useEffect(() => {
        keepOverlay()
        return () => window.clearTimeout(hideTimer.current)
    }, [paused, menu, info, model.settling])

    // Without the overlay the pill takes the focus, so OK jumps straight away.
    useEffect(() => {
        if (pillVisible && !overlay) setFocus({ area: 'pill' })
        if (!pillVisible && focus.area === 'pill') setFocus({ area: 'timebar' })
    }, [pillVisible, overlay])

    // The next-episode countdown runs 10 s and pauses while the overlay is shown.
    useEffect(() => {
        if (!nearEnd || dismissed === 'next') {
            setCountdown(null)
            return
        }
        if (overlay) return
        const timer = window.setInterval(() => {
            setCountdown((value) => {
                const elapsed = (value ?? 0) + countdownTickMs / countdownMs
                if (elapsed >= 1) {
                    window.clearInterval(timer)
                    player.playNext()
                    return null
                }
                return elapsed
            })
        }, countdownTickMs)
        return () => window.clearInterval(timer)
    }, [nearEnd, overlay, dismissed])

    const commitSeekLater = (target: number) => {
        setPendingSeek(target)
        window.clearTimeout(seekTimer.current)
        seekTimer.current = window.setTimeout(() => {
            player.seekTo(target)
            setPendingSeek(null)
            seekHeldSince.current = 0
        }, seekCommitMs)
    }
    const stepSeek = (direction: -1 | 1, repeat: boolean) => {
        const now = Date.now()
        if (!repeat || !seekHeldSince.current) seekHeldSince.current = now
        const step = now - seekHeldSince.current >= longSeekAfterMs ? longSeekStepMs : seekStepMs
        lastSeekStepAt.current = now
        commitSeekLater(Math.max(0, Math.min((pendingSeek ?? positionMs) + direction * step, durationMs)))
    }
    // Netflix and the official Jellyfin app pause while seeking, so OK right after a jump means "play".
    const playPauseOrConfirmSeek = () => {
        if (Date.now() - lastSeekStepAt.current >= confirmSeekWindowMs) {
            player.togglePause()
            return
        }
        lastSeekStepAt.current = 0
        if (pendingSeek !== null) {
            window.clearTimeout(seekTimer.current)
            player.seekTo(pendingSeek)
            setPendingSeek(null)
            seekHeldSince.current = 0
        }
        if (paused) player.togglePause()
    }

    const jump = () => {
        if (nearEnd) player.playNext()
        else if (skip) player.seekTo(skip.endMs)
    }

    const controls: Control[] = ['back10', 'playPause', 'forward10', 'audio', 'subtitles', 'info', ...(next ? (['next'] as const) : [])]
    const activate = (control: Control) => {
        switch (control) {
            case 'back10':
                commitSeekLater(Math.max(0, (pendingSeek ?? positionMs) - seekStepMs))
                break
            case 'forward10':
                commitSeekLater(Math.min(durationMs, (pendingSeek ?? positionMs) + seekStepMs))
                break
            case 'playPause':
                player.togglePause()
                break
            case 'audio':
            case 'subtitles':
                setMenu(control)
                break
            case 'info':
                setInfo((value) => !value)
                break
            case 'next':
                player.playNext()
                break
        }
    }

    useKeyLayer((key, repeat) => {
        if (model.phase === 'error') {
            if (key === 'enter') player.retry()
            else if (key === 'back') player.exit()
            return true
        }
        if (key === 'playPause' || key === 'play') {
            playPauseOrConfirmSeek()
            return true
        }
        if (key === 'pause') {
            player.togglePause()
            return true
        }
        if (key === 'stop') {
            player.exit()
            return true
        }
        if (key === 'rewind' || key === 'fastForward') {
            keepOverlay()
            stepSeek(key === 'rewind' ? -1 : 1, repeat)
            return true
        }
        if (!overlay) {
            if (key === 'back') {
                if (pillVisible) setDismissed(pillKey)
                else player.exit()
            } else if (key === 'enter' && pillVisible) {
                jump()
            } else {
                setFocus({ area: 'timebar' })
                keepOverlay()
            }
            return true
        }
        keepOverlay()
        if (key === 'back') {
            if (info) setInfo(false)
            else setOverlay(false)
            return true
        }
        if (focus.area === 'timebar') {
            if (key === 'left' || key === 'right') stepSeek(key === 'left' ? -1 : 1, repeat)
            else if (key === 'enter') playPauseOrConfirmSeek()
            else if (key === 'down') setFocus({ area: 'controls', control: 'playPause' })
            else if (key === 'up' && pillVisible) setFocus({ area: 'pill' })
            return true
        }
        if (focus.area === 'pill') {
            if (key === 'enter') jump()
            else if (key === 'down') setFocus({ area: 'timebar' })
            return true
        }
        const index = controls.indexOf(focus.control)
        if (key === 'left' || key === 'right') {
            const target = controls[index + (key === 'left' ? -1 : 1)]
            if (target) setFocus({ area: 'controls', control: target })
        } else if (key === 'up') {
            setFocus({ area: 'timebar' })
        } else if (key === 'enter') {
            activate(focus.control)
        }
        return true
    })

    const streams = plan?.mediaSource.MediaStreams ?? []
    const audioStreams = streams.filter((stream) => stream.Type === 'Audio')
    const subtitleStreams = streams.filter((stream) => stream.Type === 'Subtitle')
    const closeMenu = () => {
        setMenu(null)
        keepOverlay()
    }
    const audioOptions: MenuOption[] = audioStreams.map((stream, index) => {
        const { label, title } = labelFor(stream, audioStreams, index)
        return {
            key: `audio-${stream.Index}`,
            label,
            detail: [title, audioCodecName(stream.Codec ?? ''), channelLabel(stream.Channels)].filter(Boolean).join(' · '),
            selected: stream.Index === plan?.audio?.streamIndex,
            onSelect: () => {
                closeMenu()
                void player.selectAudio(stream.Index)
            },
        }
    })
    const subtitleOptions: MenuOption[] = [
        {
            key: 'off',
            label: t('player_off'),
            selected: model.subtitleIndex === null,
            onSelect: () => {
                closeMenu()
                void player.selectSubtitle(null)
            },
        },
        ...subtitleEntries(subtitleStreams, session.preferredLanguages ?? [], languageNames, appLocale()).map(
            (entry, index) => ({
                key: `subtitle-${entry.stream.Index}`,
                label: subtitleLabel(entry, index),
                detail: subtitleDetail(entry),
                selected: entry.stream.Index === model.subtitleIndex,
                onSelect: () => {
                    closeMenu()
                    void player.selectSubtitle(entry.stream.Index)
                },
            }),
        ),
        {
            key: 'size',
            header: t('player_style'),
            label: t('player_size'),
            value: t(`player_size_${settings.subtitleSize}`),
            onSelect: () => {
                const sizes: SubtitleSize[] = ['small', 'normal', 'large']
                updateSettings({ subtitleSize: sizes[(sizes.indexOf(settings.subtitleSize) + 1) % sizes.length] })
            },
        },
        {
            key: 'background',
            label: t('player_background'),
            value: t(settings.subtitleBackground ? 'player_on' : 'player_off'),
            onSelect: () => updateSettings({ subtitleBackground: !settings.subtitleBackground }),
        },
    ]

    // While the TV settles after a seek, the timebar stays on the target instead of the held frame.
    const shownPosition = pendingSeek ?? (model.settling ? model.seekTargetMs : positionMs)
    const title = item ? (item.kind === 'episode' ? item.seriesTitle : item.title) : ''
    const subtitle = item?.kind === 'episode' ? `${episodeCode(item.seasonNumber, item.episodeNumber)}  ${item.title}` : null
    const buttonIcon: Record<Control, IconName> = {
        back10: 'playerBack10',
        playPause: paused ? 'playerPlay' : 'playerPause',
        forward10: 'playerForward10',
        audio: 'playerAudio',
        subtitles: 'playerSubtitles',
        info: 'playerInfo',
        next: 'playerNext',
    }
    const tech = plan ? describePlan(plan) : null

    return (
        <div class="player" onMouseMove={() => model.phase === 'ready' && keepOverlay()}>
            <video
                ref={player.video}
                onLoadedMetadata={player.events.onLoadedMetadata}
                onTimeUpdate={player.events.onTimeUpdate}
                onPlaying={player.events.onPlaying}
                onPause={player.events.onPause}
                onEnded={player.events.onEnded}
                onError={player.events.onError}
            />
            {model.cue && (
                <div class={`subtitle-layer ${overlay ? 'raised' : ''}`}>
                    <div
                        class={`subtitle-text ${settings.subtitleBackground ? 'with-background' : ''}`}
                        style={{ fontSize: `${24 * subtitleScale[settings.subtitleSize]}px`, lineHeight: 1.3 }}
                    >
                        {model.cue}
                    </div>
                </div>
            )}
            {model.phase === 'error' ? (
                <div class="player-error">
                    <div class="display-small">{t('player_error_title')}</div>
                    <div class="body-large muted">{t('player_error_unreachable')}</div>
                    <PillButton label={t('action_retry')} focused onClick={() => player.retry()} />
                </div>
            ) : (
                <div class={`player-overlay ${overlay && item ? '' : 'hidden'}`}>
                    <div class="player-gradient" />
                    <div class="player-controls-column">
                        <div class="headline-medium ellipsis">{title}</div>
                        {subtitle && <div class="body-medium light player-subtitle-line ellipsis">{subtitle}</div>}
                        <Timebar positionMs={shownPosition} durationMs={durationMs} focused={focus.area === 'timebar'} seeking={pendingSeek !== null || model.settling} />
                        <div class="player-times body-small light">
                            <span>{formatClock(shownPosition)}</span>
                            <span class="remaining">{t('player_remaining', formatClock(durationMs - shownPosition))}</span>
                        </div>
                        <div class="player-buttons">
                            {controls.map((control, index) => (
                                <>
                                    {index === 3 && <div class="player-buttons-spacer" />}
                                    <div
                                        class={`player-button neon ${focus.area === 'controls' && focus.control === control ? 'focused' : ''}`}
                                        onMouseEnter={() => {
                                            keepOverlay()
                                            setFocus({ area: 'controls', control })
                                        }}
                                        onClick={() => activate(control)}
                                    >
                                        <Icon name={buttonIcon[control]} size={22} />
                                        {focus.area === 'controls' && focus.control === control && <NeonEffect mode="comet" />}
                                    </div>
                                </>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {pillVisible && model.phase !== 'error' && (
                <JumpPill
                    label={nearEnd ? t('player_next_episode') : undefined}
                    title={nearEnd && next ? `${episodeCode(next.seasonNumber, next.episodeNumber)}  ${next.title}` : t(skipKeys[skip?.type ?? 'Intro'])}
                    focused={focus.area === 'pill'}
                    raised={overlay}
                    countdown={nearEnd ? countdown ?? 0 : null}
                    onClick={jump}
                />
            )}
            {info && tech && plan && (
                <div class="info-panel body-small">
                    {[plan.method === 'DirectPlay' ? t('tech_direct_play') : `${tech.method}: ${plan.transcodeReasons.join(', ')}`, tech.video, tech.audio]
                        .filter(Boolean)
                        .join('\n')}
                </div>
            )}
            {menu === 'audio' && <PlayerMenu title={t('player_audio')} options={audioOptions} onClose={closeMenu} />}
            {menu === 'subtitles' && <PlayerMenu title={t('player_subtitles')} options={subtitleOptions} onClose={closeMenu} />}
        </div>
    )
}
