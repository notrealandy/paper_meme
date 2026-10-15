import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { initTooltips } from './tooltip.tsx'

initTooltips()

render(<App />, document.getElementById('app')!)

