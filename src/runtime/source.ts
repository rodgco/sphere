/**
 * Reading source files from the dev server, in the browser.
 *
 * The runtime never reads the filesystem: the file is fetched through Vite as a raw module
 * (`<base>@fs<path>?raw`), which returns `export default "<json string>"`. Reads are cached per
 * page load — one fetch per file, not per selection — and a denied or missing read degrades to
 * "no source window", never to an error (`docs/07-delivery.md` §5).
 */

import { absolutePath } from '../shared/paths.js'

export interface SourceConfig {
  /**
   * Absolute directory the dev server was started from. Svelte's reported filenames are relative
   * to it, which is not necessarily Vite's `root` (`docs/07-delivery.md` §5).
   */
  cwd: string
  base: string
  fetcher?: (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>
}

/** `<base>@fs<absolute path>?raw`, with a single slash between the pieces. */
export function sourceUrl(file: string, config: Pick<SourceConfig, 'cwd' | 'base'>): string {
  const base = config.base.endsWith('/') ? config.base : `${config.base}/`
  const absolute = absolutePath(config.cwd, file)
  // Vite's `/@fs` path must start with a slash; a Windows drive (`C:/…`) does not.
  const urlPath = absolute.startsWith('/') ? absolute : `/${absolute}`

  return `${base}@fs${urlPath}?raw`
}

/** `export default "<text>";` → `<text>`; anything else is returned unchanged. */
export function readRawModule(text: string): string {
  const match = /^export default ([\s\S]*?);?\s*$/.exec(text)
  if (match === null) return text

  try {
    const value: unknown = JSON.parse(match[1] ?? 'null')
    return typeof value === 'string' ? value : text
  } catch {
    return text
  }
}

export type SourceLoader = (file: string) => Promise<string | null>

/** One loader per page: it owns the cache. */
export function createSourceLoader(config: SourceConfig): SourceLoader {
  const cache = new Map<string, Promise<string | null>>()
  const fetcher = config.fetcher ?? ((url: string) => fetch(url))

  // A dev page hot-reloads constantly; a file cached for the page lifetime would silently
  // quote the pre-edit source on the next pick (`docs/07-delivery.md` §5).
  const hot = (
    import.meta as ImportMeta & { hot?: { on(event: string, callback: () => void): void } }
  ).hot
  hot?.on('vite:afterUpdate', () => cache.clear())

  return (file) => {
    const cached = cache.get(file)
    if (cached !== undefined) return cached

    const pending = load(file, config, fetcher)
    cache.set(file, pending)
    return pending
  }
}

async function load(
  file: string,
  config: SourceConfig,
  fetcher: NonNullable<SourceConfig['fetcher']>,
): Promise<string | null> {
  try {
    const response = await fetcher(sourceUrl(file, config))
    if (!response.ok) return null

    return readRawModule(await response.text())
  } catch {
    return null
  }
}
