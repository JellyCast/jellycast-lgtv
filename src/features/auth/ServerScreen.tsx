import { NeonEffect } from '../../core/design/components/NeonEffect'
import { useEffect, useState } from 'preact/hooks'
import { checkServer, type ServerCheck } from '../../core/api/auth'
import { discoverServers } from '../../core/api/discovery'
import { loadServer, saveServer, type KnownServer } from '../../core/api/session'
import { AuthButton } from '../../core/design/components/Buttons'
import { AuthDivider, AuthError, AuthHeading, AuthLayout, AuthText } from '../../core/design/components/Auth'
import { TextField } from '../../core/design/components/TextField'
import { useKeyLayer } from '../../core/focus/hooks'
import { useFocusList } from '../../core/focus/useFocusList'
import { t } from '../../core/i18n/i18n'
import { useNavigator } from '../../core/navigation/Navigator'
import './server.css'

type CardState = { kind: 'checking' } | ServerCheck

function errorText(check: ServerCheck): string | null {
    switch (check.kind) {
        case 'invalid':
            return t('server_error_invalid')
        case 'unreachable':
            return t('server_error_unreachable')
        case 'notJellyfin':
            return t('server_error_not_jellyfin')
        case 'tooOld':
            return t('server_error_version', check.version)
        default:
            return null
    }
}

/** More cards do not fit in the column. */
const maxServers = 3

interface ServerEntry {
    server: KnownServer
    isCurrent: boolean
    state: CardState
}

/** Connect to a server: the servers found on the network as cards, or an address typed in. */
export function ServerScreen() {
    const navigator = useNavigator()
    const known = loadServer()
    const [manual, setManual] = useState(false)
    const [servers, setServers] = useState<ServerEntry[]>(known ? [{ server: known, isCurrent: true, state: { kind: 'checking' } }] : [])
    const [searching, setSearching] = useState(true)
    const [searchRun, setSearchRun] = useState(0)
    const [address, setAddress] = useState(known ? known.serverUrl.replace(/^http:\/\//, '') : '')
    const [editing, setEditing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const updateState = (serverUrl: string, state: CardState) =>
        setServers((current) => current.map((entry) => (entry.server.serverUrl === serverUrl ? { ...entry, state } : entry)))

    useEffect(() => {
        let active = true
        if (known) checkServer(known.serverUrl).then((state) => active && updateState(known.serverUrl, state))
        setSearching(true)
        discoverServers().then((found) => {
            if (!active) return
            const fresh = found.filter((server) => server.serverUrl !== known?.serverUrl)
            const room = maxServers - (known ? 1 : 0)
            const added = fresh.slice(0, room).map((server): ServerEntry => ({ server, isCurrent: false, state: { kind: 'checking' } }))
            setServers((current) => [...current.filter((entry) => entry.isCurrent), ...added])
            setSearching(false)
            // The discovery reply has no version, so check each server separately.
            for (const entry of added) checkServer(entry.server.serverUrl).then((state) => active && updateState(entry.server.serverUrl, state))
        })
        return () => {
            active = false
        }
    }, [searchRun])

    const connect = async (target: string) => {
        if (busy) return
        setBusy(true)
        setError(null)
        const result = await checkServer(target)
        setBusy(false)
        if (result.kind !== 'ok') {
            setError(errorText(result))
            return
        }
        const server: KnownServer = { serverUrl: result.serverUrl, serverName: result.serverName }
        saveServer(server)
        navigator.push({ name: 'login' })
    }

    const nothingFound = servers.length === 0 && !searching
    const cardIds = servers.length ? servers.map((_, index) => `card-${index}`) : ['card-0']
    const ids = manual ? ['field', 'connect', 'back'] : [...cardIds, nothingFound ? 'retry' : 'manual']
    const list = useFocusList<string>(ids, manual ? (address ? 'connect' : 'field') : 'card-0', 'card-0')

    useEffect(() => {
        list.setFocused(manual ? (address ? 'connect' : 'field') : 'card-0')
        setError(null)
    }, [manual])

    const activate = (id: string) => {
        if (id.startsWith('card-')) {
            const entry = servers[Number(id.slice('card-'.length))]
            if (entry) void connect(entry.server.serverUrl)
            else if (nothingFound) setManual(true)
        } else if (id === 'manual') setManual(true)
        else if (id === 'retry') setSearchRun((run) => run + 1)
        else if (id === 'field') setEditing(true)
        else if (id === 'connect') void connect(address)
        else if (id === 'back') setManual(false)
    }

    useKeyLayer((key) => {
        if (key === 'up') return list.move(-1)
        if (key === 'down') return list.move(1)
        if (key === 'enter') {
            activate(list.focused)
            return true
        }
        if (key === 'back') {
            if (manual) {
                setManual(false)
                return true
            }
            navigator.back()
            return true
        }
        return false
    })

    const hover = (id: string) => () => list.setFocused(id)
    const click = (id: string) => () => {
        list.setFocused(id)
        activate(id)
    }

    if (!manual) {
        const message = busy
            ? t('server_checking')
            : servers.length
              ? t('server_discovery_found')
              : nothingFound
                ? t('server_discovery_none')
                : t('server_discovery_searching')
        return (
            <AuthLayout>
                <AuthHeading text={t('server_title')} />
                {error ? <AuthError text={error} /> : <AuthText text={message} minLines={2} />}
                {servers.length ? (
                    servers.map((entry, index) => (
                        <ServerCard
                            key={entry.server.serverUrl}
                            entry={entry}
                            focused={list.focused === `card-${index}`}
                            onHover={hover(`card-${index}`)}
                            onClick={click(`card-${index}`)}
                        />
                    ))
                ) : (
                    <PlaceholderCard
                        title={nothingFound ? t('server_manual') : t('server_discovery_searching_button')}
                        detail={nothingFound ? t('server_manual_example') : null}
                        focused={list.focused === 'card-0'}
                        onHover={hover('card-0')}
                        onClick={click('card-0')}
                    />
                )}
                <AuthDivider />
                {nothingFound ? (
                    <AuthButton label={t('server_discovery_retry')} icon="restart" focused={list.focused === 'retry'} onHover={hover('retry')} onClick={click('retry')} />
                ) : (
                    <AuthButton label={t('server_manual')} focused={list.focused === 'manual'} onHover={hover('manual')} onClick={click('manual')} />
                )}
            </AuthLayout>
        )
    }

    return (
        <AuthLayout>
            <AuthHeading text={t('server_title')} />
            <AuthText text={t('server_subtitle')} />
            <TextField
                label={t('server_address_label')}
                placeholder={t('server_manual_example')}
                value={address}
                onInput={setAddress}
                focused={list.focused === 'field'}
                editing={editing}
                onEditingChange={setEditing}
                onMove={(direction) => list.move(direction === 'up' ? -1 : 1)}
                onSubmit={() => list.setFocused('connect')}
                onHover={hover('field')}
            />
            {error && <AuthError text={error} />}
            <AuthButton
                label={busy ? t('server_checking') : t('server_connect')}
                focused={list.focused === 'connect'}
                onHover={hover('connect')}
                onClick={click('connect')}
            />
            <AuthDivider />
            <AuthButton label={t('server_back_to_discovery')} icon="search" focused={list.focused === 'back'} onHover={hover('back')} onClick={click('back')} />
        </AuthLayout>
    )
}

interface ServerCardProps {
    entry: ServerEntry
    focused: boolean
    onHover: () => void
    onClick: () => void
}

function ServerCard({ entry, focused, onHover, onClick }: ServerCardProps) {
    const { server, state, isCurrent } = entry
    const host = server.serverUrl.replace(/^https?:\/\//, '')
    const detail =
        state.kind === 'checking'
            ? null
            : state.kind === 'ok'
              ? t('server_card_version', state.version)
              : state.kind === 'tooOld'
                ? t('server_card_too_old', state.version)
                : t('server_card_unreachable')
    return (
        <div class={`server-card card neon scale-105 auth-center ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            <div class="server-card-text">
                <div class="title-small bold ellipsis">{state.kind === 'ok' ? state.serverName : server.serverName}</div>
                <div class="body-small muted ellipsis">{detail ? `${host} · ${detail}` : host}</div>
            </div>
            {isCurrent && <span class="label-small accent">{t('server_card_current')}</span>}
            {focused && <NeonEffect mode="halo" />}
        </div>
    )
}

interface PlaceholderCardProps {
    title: string
    detail: string | null
    focused: boolean
    onHover: () => void
    onClick: () => void
}

function PlaceholderCard({ title, detail, focused, onHover, onClick }: PlaceholderCardProps) {
    return (
        <div class={`server-card card neon scale-105 auth-center ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
            <div class="server-card-text">
                <div class="title-small bold ellipsis">{title}</div>
                {detail && <div class="body-small muted ellipsis">{detail}</div>}
            </div>
            {focused && <NeonEffect mode="halo" />}
        </div>
    )
}
