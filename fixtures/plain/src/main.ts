import { mount } from 'svelte'
import App from './App.svelte'
import './telemetry.js'

const target = document.getElementById('app')
if (!target) throw new Error('fixtures/plain: missing #app')

export default mount(App, { target })
