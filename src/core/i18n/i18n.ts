import en from './strings/en.json'
import es from './strings/es.json'
import fr from './strings/fr.json'
import nl from './strings/nl.json'

type Entry = string | Record<string, string> | string[]
type Strings = Record<string, Entry>

export type Language = 'en' | 'es' | 'fr' | 'nl'

/** English first, then A–Z by own name, as in the Android app. */
export const languages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'nl', name: 'Nederlands' },
]

const tables: Record<Language, Strings> = { en, es, fr, nl }
let current: Language = 'en'
let collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function setLanguage(language: Language): void {
    current = language
    collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true })
    if (typeof document !== 'undefined') document.documentElement.lang = language
}

export function currentLanguage(): Language {
    return current
}

/** Alphabetical order in the UI language. */
export function compareText(a: string, b: string): number {
    return collator.compare(a, b)
}

function lookup(key: string): Entry | undefined {
    return tables[current][key] ?? tables.en[key]
}

/** Fills Android format arguments: %1$s, %2$d, %s and %d. */
function format(template: string, args: (string | number)[]): string {
    let next = 0
    return template.replace(/%(?:(\d+)\$)?[sd]/g, (_, position: string | undefined) => {
        const value = position ? args[Number(position) - 1] : args[next++]
        return value === undefined ? '' : String(value)
    })
}

export function t(key: string, ...args: (string | number)[]): string {
    const entry = lookup(key)
    if (typeof entry !== 'string') return key
    return format(entry, args)
}

export function plural(key: string, count: number, ...args: (string | number)[]): string {
    const entry = lookup(key)
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return key
    const rule = new Intl.PluralRules(current).select(count)
    const template = entry[rule] ?? entry.other ?? Object.values(entry)[0]
    return format(template, args.length ? args : [count])
}

export function hasString(key: string): boolean {
    return typeof lookup(key) === 'string'
}
