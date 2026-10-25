import { describe, expect, it } from 'vitest'
import { toRemoteCommand } from './remoteControl'

describe('toRemoteCommand', () => {
    it('maps play state commands', () => {
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Pause' } })).toEqual({ kind: 'pause' })
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Unpause' } })).toEqual({ kind: 'unpause' })
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'PlayPause' } })).toEqual({ kind: 'playPause' })
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Stop' } })).toEqual({ kind: 'stop' })
    })

    it('maps next track to the next episode', () => {
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'NextTrack' } })).toEqual({ kind: 'nextEpisode' })
    })

    it('carries the tracks the phone played, with -1 as subtitles off', () => {
        const play = (subtitle: number) =>
            toRemoteCommand({
                MessageType: 'Play',
                Data: { PlayCommand: 'PlayNow', ItemIds: ['a'], AudioStreamIndex: 1, SubtitleStreamIndex: subtitle },
            })
        expect(play(3)).toMatchObject({ streams: { audio: 1, subtitle: 3 } })
        expect(play(-1)).toMatchObject({ streams: { audio: 1, subtitle: null } })
    })

    it('plays the first item at the asked position, with the id format the app uses', () => {
        expect(
            toRemoteCommand({
                MessageType: 'Play',
                Data: { PlayCommand: 'PlayNow', ItemIds: ['c21c5974-cfa1-1b6d-4bef-5e85b801f061'], StartPositionTicks: 6_000_000_000 },
            }),
        ).toEqual({ kind: 'play', itemId: 'c21c5974cfa11b6d4bef5e85b801f061', startMs: 600_000, streams: {} })
    })

    it('converts a seek from ticks to milliseconds', () => {
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Seek', SeekPositionTicks: 14_210_000_000 } })).toEqual({
            kind: 'seek',
            positionMs: 1_421_000,
        })
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Seek' } })).toBeNull()
    })

    it('maps stream commands, with -1 as subtitles off', () => {
        expect(toRemoteCommand({ MessageType: 'GeneralCommand', Data: { Name: 'SetAudioStreamIndex', Arguments: { Index: '2' } } })).toEqual({
            kind: 'audioStream',
            index: 2,
        })
        expect(toRemoteCommand({ MessageType: 'GeneralCommand', Data: { Name: 'SetSubtitleStreamIndex', Arguments: { Index: '-1' } } })).toEqual({
            kind: 'subtitleStream',
            index: null,
        })
    })

    it('ignores what the player does not act on', () => {
        expect(toRemoteCommand({ MessageType: 'Playstate', Data: { Command: 'Rewind' } })).toBeNull()
        expect(toRemoteCommand({ MessageType: 'Play', Data: { PlayCommand: 'PlayNext', ItemIds: ['abc'] } })).toBeNull()
        expect(toRemoteCommand({ MessageType: 'GeneralCommand', Data: { Name: 'ToggleMute', Arguments: {} } })).toBeNull()
        expect(toRemoteCommand({ MessageType: 'GeneralCommand', Data: { Name: 'SetAudioStreamIndex', Arguments: { Index: 'two' } } })).toBeNull()
        expect(toRemoteCommand({ MessageType: 'UserDataChanged', Data: {} })).toBeNull()
    })
})
