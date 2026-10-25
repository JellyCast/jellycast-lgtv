import { Icon } from '../../core/design/components/Icon'
import './movies.css'

/** In the section bar: the current shelf in bold with its neighbours, "…" where more shelves are. */
export function ShelfIndicator({ names, current }: { names: string[]; current: number }) {
    const from = Math.max(0, current - 1)
    const to = Math.min(names.length - 1, current + 2)
    return (
        <div class="shelf-indicator">
            <span class="shelf-indicator-divider" />
            <Icon name="shelves" size={14} class="muted" />
            {from > 0 && <span class="label-large muted">…</span>}
            {names.slice(from, to + 1).map((name, offset) => (
                <span class={`label-large ${from + offset === current ? 'bold' : 'muted shelf-other'}`}>{name}</span>
            ))}
            {to < names.length - 1 && <span class="label-large muted">…</span>}
        </div>
    )
}
