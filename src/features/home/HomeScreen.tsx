import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useKeyLayer } from '../../core/focus/hooks'
import { t } from '../../core/i18n/i18n'
import { useIsActiveScreen, useNavigator } from '../../core/navigation/Navigator'
import { HomeSection } from './HomeSection'
import { LibrarySection } from '../library/LibrarySection'
import { MoviesSection } from '../movies/MoviesSection'
import { SeriesSection } from '../series/SeriesSection'
import { SectionBar, sections } from './SectionBar'
import type { SectionName } from './sectionProps'

const exitHintMs = 2000
const settingsIndex = sections.length

/**
 * The start screen: the section bar over the selected section. Focusing a tab selects its section;
 * Back from the content goes to the bar, Back on the bar to the Home tab, and Back there twice exits.
 */
export function HomeScreen() {
    const navigator = useNavigator()
    const screenActive = useIsActiveScreen()
    const [section, setSection] = useState<SectionName>('home')
    const [zone, setZone] = useState<'bar' | 'content'>('content')
    const [barIndex, setBarIndex] = useState(0)
    const [resetKeys, setResetKeys] = useState<Record<SectionName, number>>({ home: 0, series: 0, movies: 0, library: 0 })
    const [exitHint, setExitHint] = useState(false)
    const [accessory, setAccessory] = useState<ComponentChildren>(null)
    const exitTimer = useRef(0)

    useEffect(() => () => window.clearTimeout(exitTimer.current), [])

    const selectIndex = (index: number) => {
        setBarIndex(index)
        if (index < settingsIndex) setSection(sections[index])
    }
    const toBar = (reset: boolean) => {
        if (reset) setResetKeys((keys) => ({ ...keys, [section]: keys[section] + 1 }))
        setBarIndex(sections.indexOf(section))
        setZone('bar')
    }
    const focusContent = useCallback(() => setZone('content'), [])

    useKeyLayer((key) => {
        if (zone === 'content') {
            if (key === 'up') {
                toBar(false)
                return true
            }
            if (key === 'back') {
                toBar(true)
                return true
            }
            return false
        }
        if (key === 'left' || key === 'right') {
            const next = barIndex + (key === 'left' ? -1 : 1)
            if (next >= 0 && next <= settingsIndex) selectIndex(next)
            return true
        }
        if (key === 'down') {
            setZone('content')
            return true
        }
        if (key === 'enter') {
            if (barIndex === settingsIndex) navigator.push({ name: 'settings' })
            else setZone('content')
            return true
        }
        if (key === 'back') {
            if (barIndex !== 0) {
                selectIndex(0)
            } else if (exitHint) {
                window.close()
            } else {
                setExitHint(true)
                window.clearTimeout(exitTimer.current)
                exitTimer.current = window.setTimeout(() => setExitHint(false), exitHintMs)
            }
            return true
        }
        return false
    })

    const contentFocused = zone === 'content'
    const props = (name: SectionName) => ({
        focused: contentFocused && section === name,
        visible: screenActive && section === name,
        resetKey: resetKeys[name],
        onFocusContent: focusContent,
    })

    return (
        <div class="home">
            {/* The Magic Remote pointer over the content gives the content the focus, as a key would. */}
            <div class="home-content" onMouseMove={focusContent}>
                {section === 'home' && <HomeSection {...props('home')} />}
                {section === 'series' && <SeriesSection {...props('series')} />}
                {section === 'movies' && <MoviesSection {...props('movies')} onAccessory={setAccessory} />}
                {section === 'library' && <LibrarySection {...props('library')} />}
            </div>
            <SectionBar
                selected={section}
                focusedIndex={zone === 'bar' ? barIndex : null}
                accessory={section === 'movies' ? accessory : null}
                onHover={(index) => {
                    setZone('bar')
                    selectIndex(index)
                }}
                onClick={(index) => (index === settingsIndex ? navigator.push({ name: 'settings' }) : setZone('content'))}
            />
            {exitHint && <div class="exit-hint body-medium">{t('home_exit_hint')}</div>}
        </div>
    )
}
