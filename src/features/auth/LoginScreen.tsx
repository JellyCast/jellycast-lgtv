import { useEffect, useState } from 'preact/hooks'
import { isQuickConnectEnabled, quickConnect, signInWithPassword } from '../../core/api/auth'
import { loadServer } from '../../core/api/session'
import { AuthButton, TextPill } from '../../core/design/components/Buttons'
import { AuthDivider, AuthError, AuthHeading, AuthLayout, AuthText } from '../../core/design/components/Auth'
import { TextField } from '../../core/design/components/TextField'
import { useKeyLayer } from '../../core/focus/hooks'
import { useFocusList } from '../../core/focus/useFocusList'
import { t } from '../../core/i18n/i18n'
import { useNavigator } from '../../core/navigation/Navigator'
import { useAuth } from '../../app/AppContext'
import './login.css'

type CodeState =
    | { kind: 'starting' }
    | { kind: 'waiting'; code: string }
    | { kind: 'authenticated'; code: string }
    | { kind: 'failed' }

const codeLength = 6

export function LoginScreen() {
    const navigator = useNavigator()
    const auth = useAuth()
    const server = loadServer()!
    const [mode, setMode] = useState<'code' | 'password'>('code')
    const [quickConnectDisabled, setQuickConnectDisabled] = useState(false)
    const [codeState, setCodeState] = useState<CodeState>({ kind: 'starting' })
    const [attempt, setAttempt] = useState(0)
    const [userName, setUserName] = useState('')
    const [password, setPassword] = useState('')
    const [editing, setEditing] = useState<'user' | 'password' | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (mode !== 'code') return
        const abort = new AbortController()
        setCodeState({ kind: 'starting' })
        ;(async () => {
            try {
                if (!(await isQuickConnectEnabled(server.serverUrl))) {
                    setQuickConnectDisabled(true)
                    setMode('password')
                    return
                }
                const session = await quickConnect(server.serverUrl, server.serverName, (code) => setCodeState({ kind: 'waiting', code }), abort.signal)
                setCodeState((state) => ({ kind: 'authenticated', code: state.kind === 'waiting' ? state.code : '' }))
                auth.onSignedIn(session)
            } catch {
                if (!abort.signal.aborted) setCodeState({ kind: 'failed' })
            }
        })()
        return () => abort.abort()
    }, [mode, attempt])

    const submit = async () => {
        const name = userName.trim()
        if (!name || busy) return
        setBusy(true)
        setError(null)
        const result = await signInWithPassword(server.serverUrl, server.serverName, name, password)
        setBusy(false)
        if (result.kind === 'ok') auth.onSignedIn(result.session)
        else setError(result.kind === 'invalidCredentials' ? t('login_error_credentials') : t('login_error_unreachable'))
    }

    const ids =
        mode === 'code'
            ? ['usePassword', ...(codeState.kind === 'failed' ? ['retry'] : []), 'changeServer']
            : ['user', 'password', 'submit', ...(quickConnectDisabled ? [] : ['useCode']), 'changeServer']
    const list = useFocusList<string>(ids, mode === 'code' ? 'usePassword' : 'user')
    useEffect(() => {
        list.setFocused(mode === 'code' ? 'usePassword' : 'user')
        setError(null)
    }, [mode])

    const activate = (id: string) => {
        if (id === 'usePassword') setMode('password')
        else if (id === 'useCode') setMode('code')
        else if (id === 'retry') setAttempt((value) => value + 1)
        else if (id === 'user') setEditing('user')
        else if (id === 'password') setEditing('password')
        else if (id === 'submit') void submit()
        else if (id === 'changeServer') navigator.push({ name: 'server' })
    }

    useKeyLayer((key) => {
        if (key === 'up') return list.move(-1)
        if (key === 'down') return list.move(1)
        if (key === 'enter') {
            activate(list.focused)
            return true
        }
        if (key === 'back') {
            if (mode === 'password' && !quickConnectDisabled) setMode('code')
            else navigator.back()
            return true
        }
        return false
    })

    const hover = (id: string) => () => list.setFocused(id)
    const click = (id: string) => () => {
        list.setFocused(id)
        activate(id)
    }
    const host = new URL(server.serverUrl).hostname
    const footer = (
        <>
            <span class="online-dot" />
            <span class="body-small muted">{t('login_connected', host, server.serverName)}</span>
            <TextPill label={t('login_change_server')} focused={list.focused === 'changeServer'} onHover={hover('changeServer')} onClick={click('changeServer')} />
        </>
    )

    if (mode === 'code') {
        const code = codeState.kind === 'waiting' || codeState.kind === 'authenticated' ? codeState.code : ''
        const status =
            codeState.kind === 'starting'
                ? t('login_qc_starting')
                : codeState.kind === 'waiting'
                  ? t('login_qc_waiting')
                  : codeState.kind === 'authenticated'
                    ? t('login_qc_authenticated')
                    : t('login_qc_failed')
        return (
            <AuthLayout footer={footer}>
                <AuthHeading text={t('login_qc_heading')} />
                <CodeBoxes code={code} />
                <AuthText text={t('login_qc_instructions')} />
                <div class="code-status">
                    <span class={`code-dot ${codeState.kind}`} />
                    <span class="body-medium muted">{status}</span>
                </div>
                <AuthDivider />
                <AuthButton label={t('login_use_password')} icon="lock" focused={list.focused === 'usePassword'} onHover={hover('usePassword')} onClick={click('usePassword')} />
                {codeState.kind === 'failed' && (
                    <AuthButton label={t('login_qc_retry')} icon="restart" focused={list.focused === 'retry'} onHover={hover('retry')} onClick={click('retry')} />
                )}
            </AuthLayout>
        )
    }

    const moveFrom = (direction: 'up' | 'down') => list.move(direction === 'up' ? -1 : 1)
    return (
        <AuthLayout footer={footer}>
            <AuthHeading text={t('login_password_heading')} />
            {quickConnectDisabled && <AuthText text={t('login_qc_disabled')} />}
            <TextField
                label={t('login_username')}
                value={userName}
                onInput={setUserName}
                focused={list.focused === 'user'}
                editing={editing === 'user'}
                onEditingChange={(value) => setEditing(value ? 'user' : null)}
                onMove={moveFrom}
                onSubmit={() => list.setFocused('password')}
                onHover={hover('user')}
            />
            <TextField
                label={t('login_password')}
                value={password}
                onInput={setPassword}
                password
                focused={list.focused === 'password'}
                editing={editing === 'password'}
                onEditingChange={(value) => setEditing(value ? 'password' : null)}
                onMove={moveFrom}
                onSubmit={() => {
                    list.setFocused('submit')
                    void submit()
                }}
                onHover={hover('password')}
            />
            {error && <AuthError text={error} />}
            <AuthButton label={busy ? t('login_busy') : t('login_submit')} focused={list.focused === 'submit'} onHover={hover('submit')} onClick={click('submit')} />
            {!quickConnectDisabled && (
                <>
                    <AuthDivider />
                    <AuthButton label={t('login_use_code')} icon="phone" focused={list.focused === 'useCode'} onHover={hover('useCode')} onClick={click('useCode')} />
                </>
            )}
        </AuthLayout>
    )
}

/** Six boxes, 3 + 3, with the Quick Connect code. */
function CodeBoxes({ code }: { code: string }) {
    return (
        <div class="code-boxes">
            {Array.from({ length: codeLength }, (_, index) => (
                <div class={`code-box ${index === 3 ? 'gap' : ''}`}>
                    <span class="display-small">{code[index] ?? ''}</span>
                </div>
            ))}
        </div>
    )
}
