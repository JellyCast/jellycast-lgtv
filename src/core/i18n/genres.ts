import { compareText, hasString, t } from './i18n'

/** Keys are the English genre names the server takes from TMDb. */
const genreKeys: Record<string, string> = {
    Action: 'genre_action',
    'Action & Adventure': 'genre_action_adventure',
    Adventure: 'genre_adventure',
    Animation: 'genre_animation',
    Comedy: 'genre_comedy',
    Crime: 'genre_crime',
    Documentary: 'genre_documentary',
    Drama: 'genre_drama',
    Family: 'genre_family',
    Fantasy: 'genre_fantasy',
    History: 'genre_history',
    Horror: 'genre_horror',
    Kids: 'genre_kids',
    Music: 'genre_music',
    Mystery: 'genre_mystery',
    News: 'genre_news',
    Reality: 'genre_reality',
    Romance: 'genre_romance',
    'Sci-Fi & Fantasy': 'genre_scifi_fantasy',
    'Science Fiction': 'genre_science_fiction',
    Soap: 'genre_soap',
    Talk: 'genre_talk',
    Thriller: 'genre_thriller',
    'TV Movie': 'genre_tv_movie',
    War: 'genre_war',
    'War & Politics': 'genre_war_politics',
    Western: 'genre_western',
}

/** Unknown genres are shown as the server names them. */
export function genreName(serverName: string): string {
    const key = genreKeys[serverName]
    return key && hasString(key) ? t(key) : serverName
}

export function compareGenres(a: string, b: string): number {
    return compareText(a, b)
}
