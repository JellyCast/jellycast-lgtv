import { decodableAudioCodecs } from './audioTrack'

export type HlsContainer = 'mp4' | 'ts'

/** Which codecs the TV decodes itself; the C2 (webOS 24) and CS (webOS 25) decode neither. */
export interface ProfileOptions {
    dts: boolean
    trueHd: boolean
    hlsContainer: HlsContainer
    /** The Quality setting; 200 Mbps means no limit in the LAN. */
    maxBitrate: number
    burnInAss: boolean
}

export const defaultProfileOptions: ProfileOptions = {
    dts: false,
    trueHd: false,
    hlsContainer: 'mp4',
    maxBitrate: 200_000_000,
    burnInAss: false,
}

const directPlayContainers = 'mkv,mp4,m4v,mov,ts,m2ts,webm'
const directPlayVideoCodecs = 'h264,hevc,vp9,av1'
const transcodeAudioCodecs = 'eac3,ac3,aac'
const transcodeMaxAudioChannels = '6'

/** `burnInFormat`: the subtitle codec the server must burn in for this plan, if any. */
export function buildDeviceProfile(options: ProfileOptions, burnInFormat?: string): object {
    return {
        Name: 'JellyCast webOS 22',
        MaxStreamingBitrate: options.maxBitrate,
        MaxStaticBitrate: options.maxBitrate,
        MusicStreamingTranscodingBitrate: 384_000,
        DirectPlayProfiles: [
            {
                Type: 'Video',
                Container: directPlayContainers,
                VideoCodec: directPlayVideoCodecs,
                AudioCodec: decodableAudioCodecs(options).join(','),
            },
        ],
        TranscodingProfiles: [
            {
                Type: 'Video',
                Context: 'Streaming',
                Protocol: 'hls',
                Container: options.hlsContainer,
                VideoCodec: options.hlsContainer === 'mp4' ? 'hevc,h264' : 'h264,hevc',
                AudioCodec: transcodeAudioCodecs,
                MaxAudioChannels: transcodeMaxAudioChannels,
                BreakOnNonKeyFrames: true,
                MinSegments: 1,
            },
        ],
        ContainerProfiles: [],
        CodecProfiles: [],
        SubtitleProfiles: burnInFormat ? [{ Format: burnInFormat, Method: 'Encode' }] : [],
    }
}
