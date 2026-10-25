import { describe, expect, it } from 'vitest'
import { languageCodes } from './originalLanguage'

describe('languageCodes', () => {
    it('reads every language code in the answer once', () => {
        const answer = { results: { bindings: [{ code: { value: 'en' } }, { code: { value: 'ru' } }, { code: { value: 'en' } }] } }

        expect(languageCodes(answer)).toEqual(['en', 'ru'])
    })

    it('gives no language for an unknown title', () => {
        expect(languageCodes({ results: { bindings: [] } })).toEqual([])
    })
})
