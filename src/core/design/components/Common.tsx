import { t } from '../../i18n/i18n'
import { Icon } from './Icon'
import { PillButton } from './Buttons'
import './common.css'

export function ErrorState({ message, focused, onRetry, onHover }: { message: string; focused: boolean; onRetry: () => void; onHover?: () => void }) {
    return (
        <div class="error-state">
            <div class="body-medium muted">{message}</div>
            <PillButton label={t('action_retry')} focused={focused} onHover={onHover} onClick={onRetry} />
        </div>
    )
}

interface NeighboursProps {
    previous: string | null
    next: string | null
    position: number
    count: number
}

/** "‹ previous · n / m · next ›" at the bottom left of a stack. */
export function StackNeighbours({ previous, next, position, count }: NeighboursProps) {
    return (
        <div class="stack-neighbours">
            {previous && (
                <div class="neighbour body-small muted">
                    <Icon name="chevronLeft" size={14} />
                    <span class="ellipsis">{previous}</span>
                </div>
            )}
            <span class="label-medium tech neighbours-position">{t('stack_position', position, count)}</span>
            {next && (
                <div class="neighbour body-small">
                    <span class="ellipsis">{next}</span>
                    <Icon name="chevronRight" size={14} />
                </div>
            )}
        </div>
    )
}
