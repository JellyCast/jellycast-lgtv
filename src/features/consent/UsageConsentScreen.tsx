import { useState } from 'preact/hooks'
import { AuthButton } from '../../core/design/components/Buttons'
import { AuthHeading, AuthLayout, AuthText } from '../../core/design/components/Auth'
import { useKeyLayer } from '../../core/focus/hooks'
import { useFocusList } from '../../core/focus/useFocusList'
import { t } from '../../core/i18n/i18n'
import { deviceDetails } from '../../core/service/jellyCastService'
import type { UsageChoice } from '../../core/service/usage'
import './consent.css'

type Button = 'continue' | 'decline' | 'more'
const buttons: Button[] = ['continue', 'decline', 'more']

/**
 * Asked once, before the app itself: may JellyCast count this TV? Continue (initial focus)
 * allows it; declining is the next button, and the app works the same either way.
 */
export function UsageConsentScreen({ onChoose }: { onChoose: (choice: UsageChoice) => void }) {
    const list = useFocusList<Button>(buttons, 'continue')
    const [showsDetails, setShowsDetails] = useState(false)

    const activate = (button: Button) => {
        if (button === 'continue') onChoose('allowed')
        else if (button === 'decline') onChoose('declined')
        else setShowsDetails((shown) => !shown)
    }

    useKeyLayer((key) => {
        if (key === 'up') return list.move(-1)
        if (key === 'down') return list.move(1)
        if (key === 'enter') activate(list.focused)
        else return key === 'back'
        return true
    })

    const label: Record<Button, string> = {
        continue: t('usage_continue'),
        decline: t('usage_continue_without'),
        more: t('usage_more'),
    }
    return (
        <AuthLayout spacing={12}>
            <AuthHeading text={t('usage_title')} />
            {showsDetails ? <Details /> : <AuthText text={t('usage_intro')} />}
            {buttons.map((id) => (
                <AuthButton key={id} label={label[id]} focused={list.focused === id} onHover={() => list.setFocused(id)} onClick={() => activate(id)} />
            ))}
        </AuthLayout>
    )
}

function Details() {
    const device = deviceDetails()
    const thisDevice = [device.model || 'LG', `webOS ${device.osVersion}`.trim(), `JellyCast ${device.appVersion}`].join(', ')
    const lines = [
        t('usage_detail_ping'),
        t('usage_detail_device', thisDevice),
        t('usage_detail_country'),
        t('usage_detail_retention'),
        t('usage_detail_settings'),
    ]
    return (
        <div class="consent-details">
            {lines.map((line) => (
                <div key={line} class="body-small muted">
                    {line}
                </div>
            ))}
        </div>
    )
}
