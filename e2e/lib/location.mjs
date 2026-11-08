/** Helpers shared by the location script: prompts from the clipboard and DOM surgery. */

export function option(page, name) {
  return page.evaluate(
    (key) =>
      document
        .getElementById('sphere-host')
        ?.shadowRoot?.querySelector(`input[type="checkbox"]`) !== null,
    name,
  )
}

export function promptFromClipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText())
}

/** Rewrites Svelte's recorded line, simulating the positional drift of hydration. */
export function setRecordedLine(page, selector, line) {
  return page.evaluate(
    ({ selector, line }) => {
      const element = document.querySelector(selector)
      if (!element?.__svelte_meta?.loc) throw new Error(`${selector} has no __svelte_meta.loc`)
      element.__svelte_meta.loc.line = line
    },
    { selector, line },
  )
}

export function lineOf(page, needle) {
  return page.evaluate(async (needle) => {
    const text = await (await fetch('/src/App.svelte?raw')).text()
    const source = JSON.parse(text.replace(/^export default /, '').replace(/;$/, ''))
    const lines = source.split('\n')
    const index = lines.findIndex((line) => line.includes(needle))
    if (index === -1) throw new Error(`not found in App.svelte: ${needle}`)
    return index + 1
  }, needle)
}
