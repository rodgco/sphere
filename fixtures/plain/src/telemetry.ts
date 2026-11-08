/**
 * Counters for the end-to-end tests: they prove that events which should reach the page did, and
 * that events picking should swallow did not. Bubble phase on purpose — the overlay stops
 * propagation before the event gets here when it is swallowed.
 */
const counters = { click: 0, pointerdown: 0, contextmenu: 0, keydown: 0 }

declare global {
  interface Window {
    __sphereTestCounters?: typeof counters
  }
}

window.__sphereTestCounters = counters

for (const type of ['click', 'pointerdown', 'contextmenu', 'keydown'] as const) {
  window.addEventListener(type, () => {
    counters[type] += 1
  })
}

export {}
