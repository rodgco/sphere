/**
 * Paths that reach the screen or the clipboard are project-relative.
 *
 * Svelte reports whatever filename the compiler was given — absolute for a plain Vite app,
 * root-relative when the host passes a relative one — and Windows uses `\` while Vite ids usually
 * use `/`. The prompt must never contain a machine path (`docs/05-prompt-format.md` §6), and
 * neither must the panel: the same rule, one set of browser-safe helpers.
 */
export type RelativePath = (path: string | null) => string | null

/** Vite ids and Svelte filenames may mix separators; compare and display one form. */
export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

/** POSIX, Windows drive, or UNC. A root-relative path has no leading slash in this project. */
export function isAbsolutePath(path: string): boolean {
  const normalized = normalizePath(path)
  return (
    normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
  )
}

/** The last segment, with a query/fragment removed and both separators accepted. */
export function baseName(path: string): string {
  const clean = normalizePath(path).split(/[?#]/)[0] ?? ''
  const slash = clean.lastIndexOf('/')
  return slash === -1 ? clean : clean.slice(slash + 1)
}

export function relativeTo(root: string | undefined): RelativePath {
  if (root === undefined || root === '') {
    return (path) => {
      if (path === null) return null
      const clean = stripQuery(normalizePath(path))
      return isAbsolutePath(clean) ? `external/${baseName(clean)}` : clean.replace(/^\.\//, '')
    }
  }

  const normalizedRoot = stripTrailingSlash(normalizePath(root))
  const caseInsensitive = /^[A-Za-z]:\//.test(normalizedRoot)

  return (path) => {
    if (path === null) return null

    const normalized = stripQuery(normalizePath(path))
    if (!isAbsolutePath(normalized)) return normalized.replace(/^\.\//, '')

    const prefix = `${normalizedRoot}/`
    const haystack = caseInsensitive ? normalized.toLowerCase() : normalized
    const needle = caseInsensitive ? prefix.toLowerCase() : prefix
    const exact = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot

    if (haystack === exact) return ''
    if (haystack.startsWith(needle)) return normalized.slice(prefix.length)

    // Never print a machine path for a file outside the project (a symlink or a linked package).
    return `external/${baseName(normalized)}`
  }
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function stripQuery(path: string): string {
  return path.split(/[?#]/)[0] ?? ''
}
