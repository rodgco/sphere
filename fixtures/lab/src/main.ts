import { mount } from 'svelte'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('fixtures/lab: missing #app')

export default mount(App, { target })
