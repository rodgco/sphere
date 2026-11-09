import { mount } from 'svelte'
import Overlay from './Overlay.svelte'
import { sphereConfig } from './config.js'
import { HOST_ID } from './host.js'
import { OVERLAY_CSS } from './styles.js'
import { applyTheme } from './theme.js'

/**
 * The overlay is the only thing Sphere puts in the page: one host element with a shadow root, so
 * the app's CSS cannot reach it and its CSS cannot reach the app (`docs/06-toolbar-ux.md` §7).
 *
 * The mount is guarded twice: a host that already exists (HMR re-runs this module) and a throwing
 * mount (a Sphere bug must leave the page as it was).
 */
export function mountOverlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  if (document.getElementById(HOST_ID)) return null

  const host = document.createElement('div')
  host.id = HOST_ID
  // Theme first: the host carries the tokens and the forced mode, and the stylesheet reads them
  // as soon as the component mounts (`docs/13-theming.md` §3).
  applyTheme(host, sphereConfig.theme)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = OVERLAY_CSS
  shadow.append(style)

  try {
    mount(Overlay, { target: shadow })
  } catch (error) {
    host.remove()
    console.warn('[sphere] overlay failed to mount; leaving the page alone', error)
    return null
  }

  document.documentElement.append(host)
  return host
}

mountOverlay()
