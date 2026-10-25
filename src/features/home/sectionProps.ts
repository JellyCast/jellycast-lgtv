export type SectionName = 'home' | 'series' | 'movies' | 'library'

export interface SectionProps {
    /** The section's content has the remote's focus (not the section bar). */
    focused: boolean
    /** The section is on screen; it refreshes each time this becomes true. */
    visible: boolean
    /** Changes when the section must silently return to its starting point. */
    resetKey: number
    /** The section's content asks for focus, e.g. after Back or ↓ from the bar. */
    onFocusContent: () => void
}
