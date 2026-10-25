import { NeonEffect } from '../../core/design/components/NeonEffect'
import { Icon } from '../../core/design/components/Icon'
import { t } from '../../core/i18n/i18n'
import type { ComponentChildren } from 'preact'
import type { SectionName } from './sectionProps'
import './sectionBar.css'

export const sections: SectionName[] = ['home', 'series', 'movies', 'library']
const labels: Record<SectionName, string> = {
    home: 'home_section_home',
    series: 'home_section_series',
    movies: 'home_section_movies',
    library: 'home_section_library',
}

interface SectionBarProps {
    selected: SectionName
    /** Index of the focused element (tabs, then settings), or null when the bar has no focus. */
    focusedIndex: number | null
    accessory?: ComponentChildren
    onHover: (index: number) => void
    onClick: (index: number) => void
}

export function SectionBar({ selected, focusedIndex, accessory, onHover, onClick }: SectionBarProps) {
    return (
        <div class="section-bar">
            {sections.map((section, index) => (
                <div
                    class={`section-tab ${section === selected ? 'selected' : ''} ${focusedIndex === index ? 'focused' : ''}`}
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onClick(index)}
                >
                    <span class="title-medium">{t(labels[section])}</span>
                    <span class="section-underline" />
                </div>
            ))}
            {accessory}
            <div class="section-spacer" />
            <div
                class={`section-settings neon scale-110 ${focusedIndex === sections.length ? 'focused' : ''}`}
                onMouseEnter={() => onHover(sections.length)}
                onClick={() => onClick(sections.length)}
            >
                <Icon name="settings" size={20} />
                {focusedIndex === sections.length && <NeonEffect mode="comet" />}
            </div>
        </div>
    )
}
