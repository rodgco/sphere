/**
 * Virtual module ids and the URL form Vite serves them under.
 *
 * A virtual id starts with `\0`, which a URL cannot carry; Vite encodes it as
 * `__x00__` behind the `/@id/` prefix.
 *
 * No base here on purpose: a tag returned from `transformIndexHtml` is rewritten by
 * Vite's own dev HTML transform, which prefixes `config.base` to every root-relative
 * `src` (Vite 8.3.6, `processNodeUrl`). Prefixing it as well produces `/app/app/…`
 * and a 404. Raw HTML insertion — the SvelteKit path in `docs/07-delivery.md` §3 —
 * bypasses that transform and must call `idToUrl` through `withBase`.
 */
export const HELLO_ID = '\0virtual:sphere/hello'

export function idToUrl(id: string): string {
  return `/@id/${id.replaceAll('\0', '__x00__')}`
}

/** For URLs inserted outside Vite's HTML pipeline (SvelteKit templates, `/@fs`, fetch). */
export function withBase(url: string, base: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${url.replace(/^\//, '')}`
}
