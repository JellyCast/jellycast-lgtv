export interface Cue {
    startMs: number
    endMs: number
    text: string
}

function parseTimestamp(value: string): number {
    const parts = value.trim().split(':')
    const [seconds, millis = '0'] = parts.pop()!.split('.')
    const minutes = Number(parts.pop() ?? 0)
    const hours = Number(parts.pop() ?? 0)
    return ((hours * 60 + minutes) * 60 + Number(seconds)) * 1000 + Number(millis.padEnd(3, '0').slice(0, 3))
}

/** WebVTT as the server converts every text format to; tags are reduced to plain lines. */
export function parseVtt(source: string): Cue[] {
    const cues: Cue[] = []
    for (const block of source.replace(/\r/g, '').split(/\n{2,}/)) {
        const lines = block.split('\n')
        const timing = lines.findIndex((line) => line.includes('-->'))
        if (timing < 0) continue
        const [start, end] = lines[timing].split('-->')
        const text = lines
            .slice(timing + 1)
            .join('\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\{\\[^}]*\}/g, '')
            .trim()
        if (text) cues.push({ startMs: parseTimestamp(start), endMs: parseTimestamp(end.trim().split(/\s+/)[0]), text })
    }
    return cues.sort((a, b) => a.startMs - b.startMs)
}

export function cueAt(cues: Cue[], positionMs: number): string | null {
    const active = cues.filter((cue) => positionMs >= cue.startMs && positionMs < cue.endMs)
    return active.length ? active.map((cue) => cue.text).join('\n') : null
}

/** Image subtitles cannot be drawn as text; the server has to burn them in. */
export function isImageSubtitle(codec: string | undefined): boolean {
    return ['pgssub', 'pgs', 'dvdsub', 'dvbsub', 'vobsub'].includes((codec ?? '').toLowerCase())
}
