import { NeonEffect } from './NeonEffect'
import { useState } from 'preact/hooks'
import { useKeyLayer } from '../../focus/hooks'
import './options.css'

export interface Option {
    key: string
    label: string
    onSelect: () => void
    dividerBefore?: boolean
}

interface OptionsPanelProps {
    title: string
    options: Option[]
    onClose: () => void
    top?: number
}

/** A 320 dp panel on the right; the focus stays inside until Back or a choice closes it. */
export function OptionsPanel({ title, options, onClose, top = 0 }: OptionsPanelProps) {
    const [index, setIndex] = useState(0)
    useKeyLayer((key) => {
        if (key === 'up' || key === 'down') {
            const next = index + (key === 'up' ? -1 : 1)
            if (next >= 0 && next < options.length) setIndex(next)
        } else if (key === 'enter') {
            options[index]?.onSelect()
        } else if (key === 'back') {
            onClose()
        }
        return true
    })
    return (
        <div class="options-panel" style={{ top: `${top}px` }}>
            <div class="label-medium heading muted options-title">{title}</div>
            {options.map((option, position) => (
                <>
                    {option.dividerBefore && <div class="options-divider" />}
                    <div
                        class={`option-row neon ${position === index ? 'focused' : ''}`}
                        onMouseEnter={() => setIndex(position)}
                        onClick={option.onSelect}
                    >
                        <span class="title-medium light">{option.label}</span>
                        {position === index && <NeonEffect mode="comet" />}
                    </div>
                </>
            ))}
        </div>
    )
}
