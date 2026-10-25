import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { signOut as signOutOnServer, validateSession } from '../core/api/auth'
import { clearSession, loadServer, loadSession, saveServer, saveSession, type Session } from '../core/api/session'
import { LibraryRepository } from '../core/data/library'
import { PlaybackService } from '../core/playback/PlaybackService'
import { RemoteControl } from '../core/playback/remoteControl'
import { getSettings, useSettings } from '../core/data/settings'
import { installKeyLayers } from '../core/focus/keyLayers'
import { setLanguage } from '../core/i18n/i18n'
import { NavigatorHost } from '../core/navigation/Navigator'
import type { Route } from '../core/navigation/routes'
import { LoginScreen } from '../features/auth/LoginScreen'
import { ServerScreen } from '../features/auth/ServerScreen'
import { AppContext, AuthContext, type AppState } from './AppContext'
import { RemotePlayListener } from './RemotePlayListener'
import { renderSignedInRoute } from './routes'
import { Splash } from './Splash'

installKeyLayers()
setLanguage(getSettings().language)

function signedOutRoute(): Route {
    return loadServer() ? { name: 'login' } : { name: 'server' }
}

export function App() {
    // Re-renders every screen when the language changes.
    useSettings()
    const [session, setSession] = useState<Session | null>(loadSession)
    const [signedOutStart, setSignedOutStart] = useState<Route>(signedOutRoute)
    const [generation, setGeneration] = useState(0)
    const [showContent, setShowContent] = useState(false)
    const [splash, setSplash] = useState(true)

    const onSignedIn = useCallback((next: Session) => {
        saveSession(next)
        saveServer({ serverUrl: next.serverUrl, serverName: next.serverName })
        setSession(next)
        setGeneration((value) => value + 1)
    }, [])

    const signOut = useCallback(
        async (toServerScreen = false) => {
            if (session) await signOutOnServer(session)
            clearSession()
            setSignedOutStart(toServerScreen ? { name: 'server' } : signedOutRoute())
            setSession(null)
            setGeneration((value) => value + 1)
        },
        [session],
    )

    useEffect(() => {
        if (!session) return
        validateSession(session).then((result) => {
            if (!result.valid) {
                clearSession()
                setSession(null)
                setGeneration((value) => value + 1)
            } else {
                const updated = {
                    ...session,
                    userName: result.userName ?? session.userName,
                    preferredLanguages: result.preferredLanguages ?? session.preferredLanguages,
                }
                if (JSON.stringify(updated) === JSON.stringify(session)) return
                saveSession(updated)
                setSession(updated)
            }
        })
    }, [])

    const appState = useMemo<AppState | null>(
        () => {
            if (!session) return null
            const playback = new PlaybackService(session)
            return { session, library: new LibraryRepository(session), playback, remote: new RemoteControl(playback.client), signOut }
        },
        [session?.accessToken, session?.preferredLanguages?.join(), signOut],
    )
    const exit = useCallback(() => window.close(), [])

    return (
        <AuthContext.Provider value={{ onSignedIn }}>
            {showContent &&
                (appState ? (
                    <AppContext.Provider value={appState}>
                        <NavigatorHost key={`in-${generation}`} initial={{ name: 'home' }} render={renderSignedInRoute} onExitRequest={exit}>
                            <RemotePlayListener />
                        </NavigatorHost>
                    </AppContext.Provider>
                ) : (
                    <NavigatorHost key={`out-${generation}`} initial={signedOutStart} render={renderSignedOutRoute} onExitRequest={exit} />
                ))}
            {splash && <Splash onDrawn={() => setShowContent(true)} onFinished={() => setSplash(false)} />}
        </AuthContext.Provider>
    )
}

function renderSignedOutRoute(route: Route) {
    return route.name === 'login' ? <LoginScreen /> : <ServerScreen />
}
