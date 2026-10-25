import { NeonEffect } from '../../core/design/components/NeonEffect'
import { Icon } from '../../core/design/components/Icon'

interface JumpPillProps {
    label?: string
    title: string
    focused: boolean
    raised: boolean
    countdown?: number | null
    onClick: () => void
}

/** One shape for every jump: "Skip intro", or the next episode with a 10 s countdown line. */
export function JumpPill({ label, title, focused, raised, countdown, onClick }: JumpPillProps) {
    return (
        <div class={`jump-pill neon ${focused ? 'focused' : ''} ${label ? 'tall' : ''} ${raised ? 'raised' : ''}`} onClick={onClick}>
            <div class="jump-pill-texts">
                {label && <span class="jump-pill-label">{label}</span>}
                <span class="jump-pill-title ellipsis">{title}</span>
            </div>
            <Icon name="playerNext" size={20} />
            {focused && <NeonEffect mode="comet" />}
            {countdown != null && (
                <div class="jump-pill-countdown">
                    <div class="jump-pill-countdown-fill" style={{ transform: `scaleX(${countdown})` }} />
                </div>
            )}
        </div>
    )
}
