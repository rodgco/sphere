import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import { CONFIG_ID } from '../src/plugin/inject.js'
import { sphere } from '../src/plugin/index.js'
import { resolveOptions } from '../src/plugin/options.js'
import { applyTheme, type ThemeTarget } from '../src/overlay/theme.js'
import {
  isThemeMode,
  isThemeToken,
  isValidThemeValue,
  MAX_THEME_VALUE,
  THEME_TOKENS,
  themeProperty,
  themeValueError,
  type ResolvedTheme,
} from '../src/shared/theme.js'
import { VERSION } from '../src/shared/version.js'

describe('the theme vocabulary', () => {
  it('documents every public token in docs/13-theming.md', () => {
    const doc = readFileSync(new URL('../docs/13-theming.md', import.meta.url), 'utf8')

    for (const token of THEME_TOKENS) expect(doc).toContain(`\`${token}\``)
  })

  it('maps a token to the one public family, never to an internal name', () => {
    expect(themeProperty('bg')).toBe('--sphere-theme-bg')
    expect(themeProperty('radius-sm')).toBe('--sphere-theme-radius-sm')
  })

  it('knows the vocabulary and the modes', () => {
    expect(isThemeToken('accent')).toBe(true)
    expect(isThemeToken('brand')).toBe(false)
    expect(isThemeMode('auto')).toBe(true)
    expect(isThemeMode('system')).toBe(false)
  })
})

describe('theme value validation', () => {
  it('accepts CSS values, including a page variable', () => {
    for (const value of ['#ff0000', 'var(--cds-background)', '0 12px 32px rgb(0 0 0 / 55%)']) {
      expect(isValidThemeValue(value)).toBe(true)
    }
  })

  it('rejects the declaration, markup and escape forms that could break the contract', () => {
    const invalid = [
      'red; background: blue',
      'red} .panel { color: blue',
      'red{',
      '</style><script>alert(1)</script>',
      'red\\75 rl(https://example.com)',
      'url(https://example.com/a.png)',
      'URL (https://example.com)',
      '@import "https://example.com/x.css"',
      'expression(alert(1))',
      'red\nbackground: blue',
    ]

    for (const value of invalid) expect(themeValueError(value)).not.toBeNull()
  })

  it('bounds the value and rejects non-strings or empty strings', () => {
    expect(isValidThemeValue('a'.repeat(MAX_THEME_VALUE))).toBe(true)
    expect(isValidThemeValue('a'.repeat(MAX_THEME_VALUE + 1))).toBe(false)
    expect(isValidThemeValue('')).toBe(false)
    expect(isValidThemeValue('   ')).toBe(false)
    expect(isValidThemeValue(12)).toBe(false)
  })
})

describe('resolveOptions: theme', () => {
  it('defaults to auto with no tokens', () => {
    expect(resolveOptions({}).theme).toEqual({ mode: 'auto', tokens: {} })
  })

  it('accepts a mode and trims token values', () => {
    expect(
      resolveOptions({
        theme: { mode: 'dark', tokens: { accent: '  var(--brand)  ', radius: '4px' } },
      }).theme,
    ).toEqual({ mode: 'dark', tokens: { accent: 'var(--brand)', radius: '4px' } })
  })

  it('allows an empty tokens object', () => {
    expect(resolveOptions({ theme: { tokens: {} } }).theme).toEqual({ mode: 'auto', tokens: {} })
  })

  it('names an unknown theme option', () => {
    expect(() => resolveOptions({ theme: { css: 'x' } } as never)).toThrow(
      /unknown theme option "css"/,
    )
  })

  it('names an unknown token', () => {
    expect(() => resolveOptions({ theme: { tokens: { brand: '#f00' } } } as never)).toThrow(
      /unknown theme token "brand"/,
    )
  })

  it('names an invalid mode', () => {
    expect(() => resolveOptions({ theme: { mode: 'system' } } as never)).toThrow(/"theme\.mode"/)
  })

  it('names an unsafe value and the token it belongs to', () => {
    expect(() => resolveOptions({ theme: { tokens: { bg: 'url(https://example.com)' } } })).toThrow(
      /theme token "bg" must not contain url/,
    )
  })

  it('rejects a non-object theme or tokens', () => {
    expect(() => resolveOptions({ theme: 'dark' } as never)).toThrow(/"theme" must be an object/)
    expect(() => resolveOptions({ theme: [] } as never)).toThrow(/"theme" must be an object/)
    expect(() => resolveOptions({ theme: { tokens: [] } } as never)).toThrow(
      /"theme\.tokens" must be an object/,
    )
  })

  it('rejects a non-string value', () => {
    expect(() => resolveOptions({ theme: { tokens: { bg: 12 } } } as never)).toThrow(
      /theme token "bg" must be a string/,
    )
  })
})

describe('the resolved theme in virtual:sphere/config', () => {
  it('travels next to root, base, working directory and version', () => {
    const plugin = sphere({
      theme: { mode: 'light', tokens: { accent: 'var(--color-brand)' } },
    })[0] as Plugin

    ;(plugin.configResolved as unknown as (config: unknown) => void).call(plugin, {
      plugins: [],
      root: '/app',
      base: '/',
    })

    const code = (plugin.load as unknown as (id: string) => string | null).call(
      plugin,
      `\0${CONFIG_ID}`,
    )

    expect(code).toBeTypeOf('string')
    const config = JSON.parse((code as string).replace(/^export default /, '').trim())

    expect(config).toEqual({
      root: '/app',
      base: '/',
      cwd: process.cwd(),
      version: VERSION,
      theme: { mode: 'light', tokens: { accent: 'var(--color-brand)' } },
    })
  })
})

describe('applyTheme', () => {
  it('writes known tokens to the host and sets the forced mode', () => {
    const target = fakeTarget()
    const theme: ResolvedTheme = {
      mode: 'dark',
      tokens: { bg: 'var(--cds-background)', radius: '0' },
    }

    applyTheme(target, theme)

    expect(target.dataset).toEqual({ sphereMode: 'dark' })
    expect(target.values).toEqual({
      '--sphere-theme-bg': 'var(--cds-background)',
      '--sphere-theme-radius': '0',
    })
  })

  it('leaves the attribute absent for auto, so the media query decides', () => {
    const target = fakeTarget()
    target.dataset.sphereMode = 'dark'

    applyTheme(target, { mode: 'auto', tokens: {} })

    expect(target.dataset.sphereMode).toBeUndefined()
  })

  it('tolerates a stale config that has no theme', () => {
    const target = fakeTarget()

    expect(() => applyTheme(target, undefined)).not.toThrow()
    expect(target.values).toEqual({})
  })

  it('drops a token or value that does not fit the contract, instead of writing it', () => {
    const target = fakeTarget()
    const tampered = {
      mode: 'light',
      tokens: {
        bg: '#fff',
        brand: '#f00',
        accent: 'red; background: blue',
        fg: 'url(https://example.com)',
      },
    } as unknown as ResolvedTheme

    applyTheme(target, tampered)

    expect(target.values).toEqual({ '--sphere-theme-bg': '#fff' })
  })
})

interface FakeThemeTarget extends ThemeTarget {
  values: Record<string, string>
}

function fakeTarget(): FakeThemeTarget {
  const values: Record<string, string> = {}
  const dataset: Record<string, string | undefined> = {}

  return {
    dataset,
    values,
    style: {
      setProperty(name: string, value: string) {
        values[name] = value
      },
    },
  }
}
