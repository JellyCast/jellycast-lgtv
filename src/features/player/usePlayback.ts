import { useEffect, useRef, useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { authorizationHeader } from '../../core/api/client'
import type { MediaSegment } from '../../core/data/library'
import { getSettings } from '../../core/data/settings'
import type { Episode, Playable } from '../../core/model/library'
import { nextEpisodeAfter } from '../../core/model/library'
import { isFinishedAt } from '../../core/model/segments'
import type { PlanOverrides, StreamPlan } from '../../core/playback/playbackInfo'
import { stopTranscode } from '../../core/playback/playbackInfo'
import { KeyframeSeek } from '../../core/playback/keyframeSeek'
import { PlaybackReporter } from '../../core/playback/reporter'
import type { RemoteCommand, RequestedStreams } from '../../core/playback/remoteControl'
import { cueAt, isImageSubtitle, parseVtt, type Cue } from '../../core/playback/subtitles'

const progressIntervalMs = 10_000
/** After a seek the clock first stands still on the requested time; it moves once it has landed. */
const landedAfterMovingMs = 200
const maxSettleMs = 4000
/** A track switch reloads or reparses first; report once the new choice is in the model. */
const trackReportDelayMs = 500

interface AudioTrackLike {
    enabled: boolean
}
type VideoWithTracks = HTMLVideoElement & { audioTracks?: { length: number; [index: number]: AudioTrackLike } }

export interface PlaybackModel {
    phase: 'loading' | 'ready' | 'error'
    item: Playable | null
    plan: StreamPlan | null
    next: Episode | null
    segments: MediaSegment[]
    positionMs: number
    durationMs: number
    paused: boolean
    subtitleIndex: number | null
    cue: string | null
    /** From a seek until the picture moves again: the TV holds the old frame for 1–2 s meanwhile. */
    settling: boolean
    /** Where the user aimed the last seek; shown while settling. */
    seekTargetMs: number
}

/**
 * Owns the <video> element's session: plan, start position, the chosen audio track, subtitles,
 * reporting and the switch to another item. The screen only renders and handles keys.
 */
export function usePlayback(initialItemId: string, fromStart: boolean, onExit: () => void, startMs?: number, streams: RequestedStreams = {}) {
    const { library, playback, remote, session } = useApp()
    const video = useRef<VideoWithTracks>(null)
    const reporter = useRef(new PlaybackReporter(playback.client))
    const [model, setModel] = useState<PlaybackModel>({
        phase: 'loading',
        item: null,
        plan: null,
        next: null,
        segments: [],
        positionMs: 0,
        durationMs: 0,
        paused: false,
        subtitleIndex: null,
        cue: null,
        settling: false,
        seekTargetMs: 0,
    })
    const live = useRef(model)
    live.current = model
    const cues = useRef<Cue[]>([])
    const startAt = useRef(0)
    const started = useRef(false)
    const keyframes = useRef(new KeyframeSeek())
    const seekCheck = useRef<{ requestedMs: number; firstMs: number | null } | null>(null)
    const settleTimer = useRef(0)

    const state = () => ({
        positionMs: live.current.positionMs,
        isPaused: live.current.paused,
        audioStreamIndex: live.current.plan?.audio?.streamIndex ?? null,
        subtitleStreamIndex: live.current.subtitleIndex,
    })

    const stopCurrent = (failed: boolean) => {
        const { item, plan, segments, durationMs, positionMs } = live.current
        if (!item || !plan) return
        reporter.current.stop(item.id, plan, positionMs, failed, isFinishedAt(segments, durationMs, positionMs), session.userId)
        if (plan.method === 'Transcode') stopTranscode(playback.client, plan.playSessionId).catch(() => undefined)
    }

    const attach = (plan: StreamPlan, positionMs: number) => {
        const element = video.current
        if (!element) return
        startAt.current = positionMs
        started.current = false
        keyframes.current = new KeyframeSeek()
        seekCheck.current = null
        element.src = plan.url
        element.play().catch(() => undefined)
    }

    const load = async (itemId: string, startFromBeginning: boolean, overrides: PlanOverrides = {}, startAtMs?: number) => {
        setModel((current) => ({ ...current, phase: 'loading', cue: null, subtitleIndex: null }))
        cues.current = []
        try {
            const item = await library.getPlayable(itemId)
            if (!item) throw new Error('not found')
            const [plan, segments, episodes] = await Promise.all([
                playback.plan(itemId, overrides),
                library.getSegments(itemId),
                item.kind === 'episode'
                    ? Promise.resolve(library.peekEpisodes(item.seriesId) ?? library.getEpisodes(item.seriesId)).catch(() => [])
                    : Promise.resolve([] as Episode[]),
            ])
            const next = item.kind === 'episode' ? nextEpisodeAfter(episodes, item) : null
            const startMs = startAtMs ?? (startFromBeginning ? 0 : item.resumePositionMs)
            setModel((current) => ({
                ...current,
                phase: 'ready',
                item,
                plan,
                next,
                segments,
                positionMs: startMs,
                durationMs: item.runtimeMs ?? 0,
            }))
            live.current = { ...live.current, item, plan, positionMs: startMs }
            attach(plan, startMs)
        } catch {
            setModel((current) => ({ ...current, phase: 'error' }))
        }
    }

    useEffect(() => {
        void playRequested(initialItemId, startMs, streams, fromStart)
        const timer = window.setInterval(() => {
            const { item, plan } = live.current
            if (item && plan && started.current) reporter.current.progress(item.id, plan, state())
        }, progressIntervalMs)
        return () => {
            window.clearInterval(timer)
            stopCurrent(false)
            const element = video.current
            if (element) {
                element.removeAttribute('src')
                element.load()
            }
        }
    }, [])

    // The TV starts with the first track it decodes, which may not be the chosen one.
    const applyAudioTrack = (plan: StreamPlan) => {
        const tracks = video.current?.audioTracks
        const position = plan.audio?.tvTrackPosition
        if (!tracks || position === null || position === undefined || position >= tracks.length) return
        for (let index = 0; index < tracks.length; index++) tracks[index].enabled = index === position
    }

    const events = {
        onLoadedMetadata: () => {
            const element = video.current
            const plan = live.current.plan
            if (!element || !plan) return
            applyAudioTrack(plan)
            if (startAt.current > 0) element.currentTime = startAt.current / 1000
            if (Number.isFinite(element.duration)) setModel((current) => ({ ...current, durationMs: element.duration * 1000 }))
        },
        onTimeUpdate: () => {
            const element = video.current
            if (!element) return
            const positionMs = element.currentTime * 1000
            noteLanding(positionMs)
            setModel((current) => ({ ...current, positionMs, cue: cues.current.length ? cueAt(cues.current, positionMs) : null }))
        },
        onPlaying: () => {
            const { item, plan } = live.current
            if (!item || !plan) return
            if (!started.current) {
                started.current = true
                reporter.current.start(item.id, plan, state())
            }
            setModel((current) => ({ ...current, paused: false }))
            reporter.current.progress(item.id, plan, { ...state(), isPaused: false })
        },
        onPause: () => {
            setModel((current) => ({ ...current, paused: true }))
            const { item, plan } = live.current
            if (item && plan && started.current) reporter.current.progress(item.id, plan, { ...state(), isPaused: true })
        },
        onEnded: () => {
            const next = live.current.next
            if (next) playNext()
            else exit()
        },
        onError: () => {
            stopCurrent(true)
            setModel((current) => ({ ...current, phase: 'error' }))
        },
    }

    const togglePause = () => {
        const element = video.current
        if (!element) return
        if (element.paused) element.play().catch(() => undefined)
        else element.pause()
    }

    /** The first position where the clock moves again after a seek is where the player really landed. */
    const noteLanding = (positionMs: number) => {
        const check = seekCheck.current
        if (!check || video.current?.seeking) return
        if (check.firstMs === null) {
            check.firstMs = positionMs
            return
        }
        if (Math.abs(positionMs - check.firstMs) < landedAfterMovingMs) return
        if (live.current.plan?.method === 'DirectPlay') keyframes.current.landed(check.requestedMs, positionMs)
        seekCheck.current = null
        window.clearTimeout(settleTimer.current)
        setModel((current) => ({ ...current, settling: false }))
    }

    const seekTo = (positionMs: number) => {
        const element = video.current
        if (!element) return
        const clamped = Math.max(0, Math.min(positionMs, live.current.durationMs - 1000))
        // A direct-play file seeks to the keyframe before the request; aim so it lands on the nearest one.
        const direct = live.current.plan?.method === 'DirectPlay'
        const requested = direct ? Math.min(keyframes.current.request(clamped), live.current.durationMs - 1000) : clamped
        seekCheck.current = { requestedMs: requested, firstMs: null }
        window.clearTimeout(settleTimer.current)
        settleTimer.current = window.setTimeout(() => {
            seekCheck.current = null
            setModel((current) => ({ ...current, settling: false }))
        }, maxSettleMs)
        element.currentTime = requested / 1000
        setModel((current) => ({ ...current, positionMs: clamped, settling: true, seekTargetMs: clamped }))
        const { item, plan } = live.current
        if (item && plan && started.current) reporter.current.progress(item.id, plan, { ...state(), positionMs: clamped })
    }

    const exit = () => onExit()

    const playNext = () => {
        const next = live.current.next
        if (!next) return
        stopCurrent(false)
        void load(next.id, next.isPlayed)
    }

    /** A decodable track in a direct-play file switches in place; anything else needs a new plan. */
    const selectAudio = async (streamIndex: number) => {
        const { item, plan, positionMs } = live.current
        if (!item || !plan) return
        const replanned = await playback.plan(item.id, { audioStreamIndex: streamIndex })
        if (plan.method === 'DirectPlay' && replanned.method === 'DirectPlay' && replanned.audio?.decodable) {
            setModel((current) => ({ ...current, plan: { ...plan, audio: replanned.audio } }))
            applyAudioTrack(replanned)
            return
        }
        stopCurrent(false)
        setModel((current) => ({ ...current, plan: replanned }))
        live.current = { ...live.current, plan: replanned }
        attach(replanned, positionMs)
    }

    const selectTextSubtitle = async (streamIndex: number | null) => {
        const { item, plan } = live.current
        cues.current = []
        setModel((current) => ({ ...current, subtitleIndex: streamIndex, cue: null }))
        if (streamIndex === null || !item || !plan) return
        try {
            const response = await fetch(
                `${session.serverUrl}/Videos/${item.id}/${plan.mediaSource.Id}/Subtitles/${streamIndex}/0/Stream.vtt`,
                { headers: { Authorization: authorizationHeader(session.accessToken) } },
            )
            cues.current = parseVtt(await response.text())
        } catch {
            cues.current = []
        }
    }

    /** Text subtitles draw here; image subtitles (and ASS with burn-in on) need the server to burn them in. */
    const selectSubtitle = async (streamIndex: number | null) => {
        const plan = live.current.plan
        if (streamIndex === null) {
            const burnedIn = plan?.transcodeReasons.some((reason) => reason.includes('Subtitle')) ?? false
            if (burnedIn && plan?.audio) void selectAudio(plan.audio.streamIndex)
            return selectTextSubtitle(null)
        }
        const stream = plan?.mediaSource.MediaStreams?.find((candidate) => candidate.Type === 'Subtitle' && candidate.Index === streamIndex)
        if (!stream) return
        const needsBurnIn = isImageSubtitle(stream.Codec) || (getSettings().burnInAss && /^(ass|ssa)$/i.test(stream.Codec ?? ''))
        return needsBurnIn ? selectBurnedInSubtitle(streamIndex) : selectTextSubtitle(streamIndex)
    }

    const reportNow = () => {
        const { item, plan } = live.current
        if (item && plan && started.current) reporter.current.progress(item.id, plan, state())
    }

    /** Starts with the tracks another device played; without them the app chooses as usual. */
    const playRequested = async (itemId: string, startAtMs: number | undefined, requested: RequestedStreams, startFromBeginning = false) => {
        await load(itemId, startFromBeginning, { audioStreamIndex: requested.audio }, startAtMs)
        if (typeof requested.subtitle === 'number' && live.current.item?.id === itemId) await selectSubtitle(requested.subtitle)
    }

    const onRemoteCommand = (command: RemoteCommand) => {
        const element = video.current
        switch (command.kind) {
            case 'pause':
                element?.pause()
                return
            case 'unpause':
                if (element?.paused) element.play().catch(() => undefined)
                return
            case 'playPause':
                togglePause()
                return
            case 'stop':
                exit()
                return
            case 'nextEpisode':
                playNext()
                return
            case 'play':
                stopCurrent(false)
                void playRequested(command.itemId, command.startMs, command.streams)
                return
            case 'seek':
                seekTo(command.positionMs)
                return
            case 'audioStream':
                void selectAudio(command.index).then(() => window.setTimeout(reportNow, trackReportDelayMs))
                return
            case 'subtitleStream':
                void selectSubtitle(command.index).then(() => window.setTimeout(reportNow, trackReportDelayMs))
        }
    }
    const remoteHandler = useRef(onRemoteCommand)
    remoteHandler.current = onRemoteCommand

    useEffect(() => remote.listen((command) => remoteHandler.current(command)), [])

    /** Image subtitles (and ASS with burn-in on) can only show when the server burns them in. */
    const selectBurnedInSubtitle = async (streamIndex: number) => {
        const { item, plan, positionMs } = live.current
        if (!item || !plan) return
        stopCurrent(false)
        const replanned = await playback.plan(item.id, { audioStreamIndex: plan.audio?.streamIndex, burnInSubtitleIndex: streamIndex })
        cues.current = []
        setModel((current) => ({ ...current, plan: replanned, subtitleIndex: streamIndex, cue: null }))
        live.current = { ...live.current, plan: replanned }
        attach(replanned, positionMs)
    }

    return {
        video,
        model,
        events,
        togglePause,
        seekTo,
        playNext,
        exit,
        retry: () => live.current.item && load(live.current.item.id, false),
        selectAudio,
        selectSubtitle,
        subtitleSettings: getSettings,
    }
}
