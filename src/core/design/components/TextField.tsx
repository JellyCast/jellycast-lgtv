import { useLayoutEffect, useRef } from 'preact/hooks'
import type { IconName } from '../icons'
import { Icon } from './Icon'
import './textfield.css'

interface TextFieldProps {
    label?: string
    value: string
    onInput: (value: string) => void
    focused: boolean
    editing: boolean
    onEditingChange: (editing: boolean) => void
    /** ↑/↓ always move the focus, also while typing. */
    onMove: (direction: 'up' | 'down') => void
    onSubmit?: () => void
    onHover?: () => void
    password?: boolean
    compact?: boolean
    placeholder?: string
    icon?: IconName
}

/**
 * Read-only until OK: only then the input gets DOM focus and webOS opens its keyboard. Enter or Back
 * ends typing; the app's focus system never sees keys while the input has focus.
 */
export function TextField(props: TextFieldProps) {
    const input = useRef<HTMLInputElement>(null)
    useLayoutEffect(() => {
        if (props.editing) input.current?.focus()
        else input.current?.blur()
    }, [props.editing])
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.keyCode === 13) {
            event.preventDefault()
            props.onEditingChange(false)
            props.onSubmit?.()
        } else if (event.keyCode === 461 || event.keyCode === 27) {
            event.preventDefault()
            props.onEditingChange(false)
        } else if (event.keyCode === 38 || event.keyCode === 40) {
            event.preventDefault()
            props.onEditingChange(false)
            props.onMove(event.keyCode === 38 ? 'up' : 'down')
        }
    }
    const inputProps = {
        ref: input,
        class: props.compact ? 'body-medium' : 'title-medium',
        value: props.value,
        placeholder: props.placeholder,
        readOnly: !props.editing,
        tabIndex: -1,
        onInput: (event: Event) => props.onInput((event.target as HTMLInputElement).value),
        onKeyDown,
        onBlur: () => props.editing && props.onEditingChange(false),
        autoComplete: 'off',
        spellcheck: false,
    }
    const classes = ['text-field', props.focused && 'focused', props.compact && 'compact'].filter(Boolean).join(' ')
    return (
        <div class="text-field-wrapper" onMouseEnter={props.onHover} onClick={() => props.onEditingChange(true)}>
            {props.label && <div class="label-large muted">{props.label}</div>}
            <div class={classes}>
                {props.icon && <Icon name={props.icon} size={14} class="muted" />}
                {props.password ? <input type="password" {...inputProps} /> : <input type="text" {...inputProps} />}
            </div>
        </div>
    )
}
