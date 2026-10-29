import { useState } from 'preact/hooks'
import { useApp } from '../../app/AppContext'
import { forgetLoadedData } from '../../core/data/useLoad'
import { nextBitrate, noBitrateLimit, updateSettings, useSettings } from '../../core/data/settings'
import { AuthButton } from '../../core/design/components/Buttons'
import { AuthHeading, AuthLayout } from '../../core/design/components/Auth'
import { useKeyLayer } from '../../core/focus/hooks'
import { useFocusList } from '../../core/focus/useFocusList'
import { languages, setLanguage, t } from '../../core/i18n/i18n'
import { useNavigator } from '../../core/navigation/Navigator'
import { chooseUsage, useUsageChoice } from '../../core/service/usage'
import './settings.css'

type Button = 'language' | 'movieView' | 'quality' | 'burnInAss' | 'usage' | 'changeServer' | 'signOut'
const buttons: Button[] = ['language', 'movieView', 'quality', 'burnInAss', 'usage', 'changeServer', 'signOut']
const explanations: Partial<Record<Button, string>> = {
    language: 'settings_language_explain',
    movieView: 'settings_movie_view_explain',
    quality: 'settings_max_bitrate_explain',
    burnInAss: 'settings_burn_in_ass_explain',
    usage: 'settings_usage_footer',
}
const buildNumber = 1

/**
 * Display, Playback and Account in the sign-in layout. Android's "Advanced playback" is left out:
 * its options steer the Android player and HDMI chain, which the TV's own player does not offer.
 */
export function SettingsScreen() {
    const navigator = useNavigator()
    const { session, signOut } = useApp()
    const settings = useSettings()
    const usage = useUsageChoice()
    const list = useFocusList<Button>(buttons, 'language')
    const [signingOut, setSigningOut] = useState(false)

    const activate = (button: Button) => {
        switch (button) {
            case 'language': {
                const index = languages.findIndex((language) => language.code === settings.language)
                const next = languages[(index + 1) % languages.length].code
                setLanguage(next)
                updateSettings({ language: next })
                forgetLoadedData()
                break
            }
            case 'movieView':
                updateSettings({ movieView: settings.movieView === 'detail' ? 'bookcase' : 'detail' })
                break
            case 'quality':
                updateSettings({ maxBitrate: nextBitrate(settings.maxBitrate) })
                break
            case 'burnInAss':
                updateSettings({ burnInAss: !settings.burnInAss })
                break
            case 'usage':
                chooseUsage(usage === 'allowed' ? 'declined' : 'allowed')
                break
            case 'changeServer':
                void signOut(true)
                break
            case 'signOut':
                setSigningOut(true)
                void signOut()
                break
        }
    }

    useKeyLayer((key) => {
        if (key === 'up') return list.move(-1)
        if (key === 'down') return list.move(1)
        if (key === 'enter') activate(list.focused)
        else if (key === 'back') navigator.back()
        else return false
        return true
    })

    const languageName = languages.find((language) => language.code === settings.language)?.name ?? ''
    const label: Record<Button, string> = {
        language: t('settings_language', languageName),
        movieView: t(settings.movieView === 'detail' ? 'settings_movie_view_detail' : 'settings_movie_view_bookcase'),
        quality: settings.maxBitrate >= noBitrateLimit ? t('settings_max_bitrate_none') : t('settings_max_bitrate', settings.maxBitrate / 1_000_000),
        burnInAss: t(settings.burnInAss ? 'settings_burn_in_ass_on' : 'settings_burn_in_ass_off'),
        usage: t(usage === 'allowed' ? 'settings_usage_on' : 'settings_usage_off'),
        changeServer: t('settings_change_server'),
        signOut: signingOut ? t('settings_logging_out') : t('settings_logout'),
    }
    const button = (id: Button) => (
        <AuthButton label={label[id]} focused={list.focused === id} onHover={() => list.setFocused(id)} onClick={() => activate(id)} />
    )
    const explanation = explanations[list.focused]
    return (
        <AuthLayout
            spacing={8}
            footerReserve={180}
            footer={
                <div class="settings-footer">
                    {explanation && <div class="body-medium muted">{t(explanation)}</div>}
                    <div class="body-small muted">{t('settings_version', __APP_VERSION__, buildNumber)}</div>
                </div>
            }
        >
            <AuthHeading text={t('settings_group_display')} />
            {button('language')}
            {button('movieView')}
            <div class="settings-group-gap">
                <AuthHeading text={t('settings_group_playback')} />
            </div>
            {button('quality')}
            {button('burnInAss')}
            <div class="settings-group-gap">
                <AuthHeading text={t('settings_group_account')} />
            </div>
            <div class="body-medium muted ellipsis settings-account">{t('settings_account', session.userName, session.serverName)}</div>
            {button('usage')}
            {button('changeServer')}
            {button('signOut')}
        </AuthLayout>
    )
}
