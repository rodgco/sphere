/**
 * Paths that reach the screen or the clipboard are project-relative.
 *
 * Svelte reports whatever filename the compiler was given — absolute for a plain Vite app,
 * root-relative when the host passes a relative one. The prompt must never contain a machine path
 * (`docs/05-prompt-format.md` §6), and neither must the panel: the same rule, one function.
 */
export type RelativePath = (path: string | null) => string | null

export function relativeTo(root: string | undefined): RelativePath {
  if (root === undefined || root === '') return (path) => path

  const prefix = root.endsWith('/') ? root : `${root}/`
  return (path) => (path !== null && path.startsWith(prefix) ? path.slice(prefix.length) : path)
}
