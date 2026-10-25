// Base styles first, so component styles (loaded with their components) override them.
import './core/design/theme.css'
import './core/design/components/focus.css'
import { render } from 'preact'
import { App } from './app/App'

render(<App />, document.getElementById('app')!)
