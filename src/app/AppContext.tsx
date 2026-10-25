import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { Session } from '../core/api/session'
import type { LibraryRepository } from '../core/data/library'
import type { PlaybackService } from '../core/playback/PlaybackService'
import type { RemoteControl } from '../core/playback/remoteControl'

export interface AppState {
    session: Session
    library: LibraryRepository
    playback: PlaybackService
    remote: RemoteControl
    signOut: (toServerScreen?: boolean) => Promise<void>
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
    const app = useContext(AppContext)
    if (!app) throw new Error('useApp outside a signed-in screen')
    return app
}

export interface AuthActions {
    onSignedIn: (session: Session) => void
}

export const AuthContext = createContext<AuthActions | null>(null)

export function useAuth(): AuthActions {
    const auth = useContext(AuthContext)
    if (!auth) throw new Error('useAuth outside the app')
    return auth
}
