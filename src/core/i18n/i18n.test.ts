import { describe, expect, it } from 'vitest'
import { plural, setLanguage, t } from './i18n'

describe('i18n', () => {
    it('fills positional Android format arguments', () => {
        setLanguage('en')
        expect(t('episode_code', 3, 5)).toBe('S3 · E5')
    })

    it('picks the plural form for the count', () => {
        setLanguage('en')
        expect(plural('library_count_movies', 1)).toBe('1 movie')
        expect(plural('library_count_movies', 44)).toBe('44 movies')
    })

    it('falls back to English for a key a translation lacks', () => {
        setLanguage('nl')
        expect(t('app_name')).toBe('JellyCast')
    })
})
