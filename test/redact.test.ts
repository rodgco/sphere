import { describe, expect, it } from 'vitest'
import {
  REDACTED,
  isFormValueAttribute,
  isRedactedKey,
  isSensitiveName,
  isUrlAttribute,
  sanitizePageUrl,
  sanitizeUrlValue,
} from '../src/shared/redact.js'

describe('name-based redaction', () => {
  it('treats credential-shaped attribute names as sensitive', () => {
    for (const name of ['token', 'data-api-key', 'authorization', 'csrf-token', 'session']) {
      expect(isSensitiveName(name), name).toBe(true)
    }
    expect(isSensitiveName('title')).toBe(false)
    expect(isSensitiveName('aria-label')).toBe(false)
  })

  it('redacts PII-shaped prop keys without hiding identity keys such as name="email"', () => {
    for (const key of ['email', 'userEmail', 'phone', 'ssn', 'credit-card', 'address']) {
      expect(isRedactedKey(key), key).toBe(true)
    }
    expect(isRedactedKey('author')).toBe(false)
    expect(isRedactedKey('name')).toBe(false)
  })

  it('only treats value as a form value on form controls', () => {
    expect(isFormValueAttribute('input', 'value')).toBe(true)
    expect(isFormValueAttribute('textarea', 'value')).toBe(true)
    expect(isFormValueAttribute('option', 'value')).toBe(true)
    expect(isFormValueAttribute('div', 'value')).toBe(false)
    expect(isFormValueAttribute('input', 'name')).toBe(false)
  })
})

describe('URL sanitising', () => {
  it('strips credentials, query and fragment from absolute URLs', () => {
    expect(sanitizeUrlValue('https://user:pass@example.test/p?q=1#frag')).toBe(
      'https://example.test/p',
    )
    expect(sanitizeUrlValue('mailto:a@example.test?subject=hi')).toBe('mailto:a@example.test')
  })

  it('keeps relative paths but drops their query and fragment', () => {
    expect(sanitizeUrlValue('/files/report.pdf?token=abc#page=2')).toBe('/files/report.pdf')
    expect(sanitizeUrlValue('?filter=open')).toBe('')
  })

  it('handles protocol-relative URLs', () => {
    expect(sanitizeUrlValue('//cdn.example.test/app.js?v=1')).toBe('//cdn.example.test/app.js')
  })

  it('reduces the page URL to origin and pathname', () => {
    expect(sanitizePageUrl('http://localhost:3000/a?token=1#top')).toBe('http://localhost:3000/a')
    expect(sanitizePageUrl('file:///tmp/app/index.html?x=1')).toBe('file:///tmp/app/index.html')
  })

  it('recognises the URL-bearing attributes', () => {
    for (const name of ['href', 'src', 'action', 'formaction', 'poster']) {
      expect(isUrlAttribute(name), name).toBe(true)
    }
    expect(isUrlAttribute('title')).toBe(false)
  })

  it('has a single redacted marker', () => {
    expect(REDACTED).toBe('<redacted>')
  })
})
