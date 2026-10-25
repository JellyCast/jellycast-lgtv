import type { ComponentChildren } from 'preact'
import { t } from '../../i18n/i18n'
import { BrandMark, BrandWordmark } from './BrandMark'
import './auth.css'

interface AuthLayoutProps {
    children: ComponentChildren
    footer?: ComponentChildren
    spacing?: number
    /** Height kept free at the bottom for the footer; the brand centres in what is left. */
    footerReserve?: number
}

/** The sign-in, server and settings layout: brand on the left, one 360 dp column at x 520. */
export function AuthLayout({ children, footer, spacing = 18, footerReserve = 0 }: AuthLayoutProps) {
    return (
        <div class="auth">
            <img class="auth-background" src="images/auth_background.webp" alt="" />
            <div class="auth-brand" style={{ height: `${540 - footerReserve}px` }}>
                <BrandMark size={148} />
                <BrandWordmark />
                <div class="body-large muted">{t('auth_tagline')}</div>
            </div>
            <div class="auth-content" style={{ gap: `${spacing}px` }}>
                {children}
            </div>
            {footer && <div class="auth-footer">{footer}</div>}
        </div>
    )
}

export function AuthHeading({ text }: { text: string }) {
    return <div class="label-medium heading muted">{text}</div>
}

export function AuthText({ text, minLines }: { text: string; minLines?: number }) {
    return (
        <div class="body-medium muted auth-text" style={minLines ? { minHeight: `${minLines * 21}px` } : undefined}>
            {text}
        </div>
    )
}

export function AuthError({ text }: { text: string }) {
    return <div class="body-medium auth-error auth-text">{text}</div>
}

export function AuthDivider() {
    return (
        <div class="auth-divider">
            <span class="auth-divider-line" />
            <span class="body-small muted">{t('auth_or')}</span>
            <span class="auth-divider-line" />
        </div>
    )
}
