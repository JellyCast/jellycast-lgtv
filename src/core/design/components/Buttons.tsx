import { NeonEffect } from './NeonEffect'
import type { ComponentChildren } from 'preact'
import { Icon } from './Icon'
import type { IconName } from '../icons'
import './buttons.css'

interface PointerProps {
    onHover?: () => void
    onClick?: () => void
}

interface PillButtonProps extends PointerProps {
    label: string
    focused: boolean
    icon?: IconName
    primary?: boolean
    disabled?: boolean
    trailing?: string | null
    compact?: boolean
    class?: string
}

/** Pill, 40 high; primary has a dark fill with a thin purple edge at rest. Focus: scale 1.1 and the halo. */
export function PillButton({ label, focused, icon, primary, disabled, trailing, compact, class: className, onHover, onClick }: PillButtonProps) {
    const classes = [
        'pill',
        'neon',
        'scale-110',
        focused && 'focused',
        primary && 'primary',
        disabled && 'disabled',
        icon && 'with-icon',
        compact && 'compact',
        className,
    ]
    return (
        <div class={classes.filter(Boolean).join(' ')} onMouseEnter={onHover} onClick={disabled ? undefined : onClick}>
            {focused && <NeonEffect mode="halo" />}
            {icon && <Icon name={icon} size={16} />}
            <span class={`title-small ${primary ? 'bold' : ''}`}>{label}</span>
            {trailing && <span class="title-small pill-trailing ellipsis">{trailing}</span>}
        </div>
    )
}

interface AuthButtonProps extends PointerProps {
    label: string
    focused: boolean
    icon?: IconName
}

/** Sign-in and settings button, 250×44: rail at rest, inverted when focused. No neon. */
export function AuthButton({ label, focused, icon, onHover, onClick }: AuthButtonProps) {
    return (
        <div class={`auth-button ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            {icon && <Icon name={icon} size={16} />}
            <span class="title-small bold ellipsis">{label}</span>
        </div>
    )
}

interface ChoiceChipProps extends PointerProps {
    label: string
    focused: boolean
    selected: boolean
}

export function ChoiceChip({ label, focused, selected, onHover, onClick }: ChoiceChipProps) {
    return (
        <div class={`chip neon scale-110 ${focused ? 'focused' : ''} ${selected ? 'selected' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            {focused && <NeonEffect mode="comet" />}
            {selected && <Icon name="check" size={12} />}
            <span class={`label-medium ${selected ? 'bold' : ''}`}>{label}</span>
        </div>
    )
}

/** The "[OK] hold for more" hint. */
export function HoldOkHint({ label }: { label: string }) {
    return (
        <div class="hold-ok">
            <span class="hold-ok-key label-small">OK</span>
            <span class="body-small muted">{label}</span>
        </div>
    )
}

export function TextPill({ label, focused, onHover, onClick }: { label: string; focused: boolean } & PointerProps) {
    return (
        <div class={`text-pill label-medium ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            {label}
        </div>
    )
}

export function Row({ children, gap, class: className }: { children: ComponentChildren; gap: number; class?: string }) {
    return (
        <div class={className} style={{ display: 'flex', alignItems: 'center', gap: `${gap}px` }}>
            {children}
        </div>
    )
}
