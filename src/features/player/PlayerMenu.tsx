import { NeonEffect } from '../../core/design/components/NeonEffect'
import { useState } from 'preact/hooks'
import { Icon } from '../../core/design/components/Icon'
import { useKeyLayer } from '../../core/focus/hooks'

export interface MenuOption {
    key: string
    label: string
    value?: string
    detail?: string
    selected?: boolean
    header?: string
    onSelect: () => void
}

/** The player's 320 dp menu on the right; Back closes it and returns the focus to its button. */
export function PlayerMenu({ title, options, onClose }: { title: string; options: MenuOption[]; onClose: () => void }) {
    const [index, setIndex] = useState(() => Math.max(0, options.findIndex((option) => option.selected)))
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
    const scroll = Math.max(0, index - 6) * 50
    return (
        <div class="player-menu">
            <div class="player-menu-list" style={{ transform: `translateY(${-scroll}px)` }}>
                <div class="label-medium player-menu-header">{title}</div>
                {options.map((option, position) => (
                    <>
                        {option.header && (
                            <>
                                <div class="player-menu-divider" />
                                <div class="label-medium player-menu-header">{option.header}</div>
                            </>
                        )}
                        <div
                            class={`player-menu-row neon ${position === index ? 'focused' : ''}`}
                            onMouseEnter={() => setIndex(position)}
                            onClick={option.onSelect}
                        >
                            <div class="player-menu-texts">
                                <div class="player-menu-line">
                                    <span class="title-large ellipsis">{option.label}</span>
                                    {option.value && <span class="title-medium light player-menu-value">{option.value}</span>}
                                </div>
                                {option.detail && <div class="body-small light player-menu-detail ellipsis">{option.detail}</div>}
                            </div>
                            {option.selected && <Icon name="check" size={18} class="accent" />}
                            {position === index && <NeonEffect mode="comet" />}
                        </div>
                    </>
                ))}
            </div>
        </div>
    )
}
