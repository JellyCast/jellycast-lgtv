import type { Route } from '../core/navigation/routes'
import { MovieDetailScreen } from '../features/detail/MovieDetailScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { PlayerScreen } from '../features/player/PlayerScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { SeriesPageScreen } from '../features/seriesPage/SeriesPageScreen'

export function renderSignedInRoute(route: Route) {
    switch (route.name) {
        case 'home':
            return <HomeScreen />
        case 'movie':
            return <MovieDetailScreen movieId={route.movieId} />
        case 'series':
            return <SeriesPageScreen seriesId={route.seriesId} focusEpisodeId={route.focusEpisodeId} />
        case 'player':
            return <PlayerScreen itemId={route.itemId} fromStart={route.fromStart} startMs={route.startMs} streams={route.streams} />
        case 'settings':
            return <SettingsScreen />
        default:
            return null
    }
}
