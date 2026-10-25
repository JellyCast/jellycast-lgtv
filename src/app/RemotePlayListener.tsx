import { useEffect } from 'preact/hooks'
import { useNavigator } from '../core/navigation/Navigator'
import { useApp } from './AppContext'

/** Outside the player only "play" means something: open the player with it. */
export function RemotePlayListener() {
    const { remote } = useApp()
    const navigator = useNavigator()
    useEffect(() => {
        remote.start()
        const stopListening = remote.listen((command) => {
            if (command.kind === 'play') {
                navigator.push({ name: 'player', itemId: command.itemId, startMs: command.startMs, streams: command.streams })
            }
        })
        return () => {
            stopListening()
            remote.stop()
        }
    }, [remote])
    return null
}
