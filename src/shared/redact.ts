/**
 * Name- and channel-based redaction shared by the runtime and the formatter.
 *
 * The rules are the floor from `docs/decisions/0010-prompt-data-policy.md`: the tool can drop the
 * form values, URL queries and credential-shaped names it knows about, but it does not classify
 * arbitrary content.
 */

/** Printed where a sensitive prop or state value was removed. */
export const REDACTED = '<redacted>'

/** Attribute and object-key names that never carry a value into the prompt. */
const SECRET_NAME =
  /token|secret|password|passwd|api[-_]?key|authorization|csrf|xsrf|session|cookie|access[-_]?key|private[-_]?key/i

/** PII-shaped prop/state keys. Attribute names are not filtered by this list: `name="email"` is identity. */
const PII_NAME =
  /email|e[-_]?mail|phone|telephone|ssn|social[-_]?security|credit[-_]?card|card[-_]?number|cvv|cvc|iban|account[-_]?number|passport|birth|dob|address/i

/** Whether an attribute name is too sensitive to print. */
export function isSensitiveName(name: string): boolean {
  return SECRET_NAME.test(name)
}

/** Whether a prop/state key should keep its name but lose its value. */
export function isRedactedKey(name: string): boolean {
  return SECRET_NAME.test(name) || PII_NAME.test(name)
}

/** `value` on a form control is a form value, not identity. */
export function isFormValueAttribute(tag: string, name: string): boolean {
  if (name.toLowerCase() !== 'value') return false
  return ['input', 'textarea', 'select', 'option'].includes(tag.toLowerCase())
}

const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite'])

/** Attributes whose value is a URL and therefore may carry a query string or credentials. */
export function isUrlAttribute(name: string): boolean {
  return URL_ATTRIBUTES.has(name.toLowerCase())
}

/** Remove credentials, query and fragment from a URL value. Relative paths keep their shape. */
export function sanitizeUrlValue(value: string): string {
  if (value.startsWith('//')) {
    try {
      const url = new URL(`http:${value}`)
      return `//${url.host}${url.pathname}`
    } catch {
      return stripQuery(value)
    }
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return stripQuery(value)

  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return stripQuery(value)
  }
}

/** The page URL the prompt may show: origin and pathname, never query, fragment or credentials. */
export function sanitizePageUrl(href: string): string {
  try {
    const url = new URL(href)
    if (url.origin !== 'null') return `${url.origin}${url.pathname}`
    if (url.protocol === 'file:') return `file://${url.pathname}`
    return `${url.protocol}${url.pathname}`
  } catch {
    return stripQuery(href)
  }
}

function stripQuery(value: string): string {
  const cut = value.search(/[?#]/)
  return cut === -1 ? value : value.slice(0, cut)
}
