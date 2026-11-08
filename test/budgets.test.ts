import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VERSION } from '../src/shared/version.js'
import { LIMITS, cloneToJson, cloneValue, clip, createBudget } from '../src/runtime/budgets.js'

const json = (value: unknown) => JSON.parse(cloneToJson(value))

const packageVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

describe('clip', () => {
  it('keeps short strings and marks long ones inside the string', () => {
    expect(clip('short', 10)).toBe('short')
    expect(clip('abcdefghijkl', 5)).toBe('abcd…')
    expect(clip('abcdefghijkl', 5)).toHaveLength(5)
  })
})

describe('cloneValue', () => {
  it('keeps JSON primitives and converts what JSON cannot hold', () => {
    expect(cloneValue(null)).toBeNull()
    expect(cloneValue('a')).toBe('a')
    expect(cloneValue(1)).toBe(1)
    expect(cloneValue(true)).toBe(true)
    expect(cloneValue(Number.NaN)).toBe('NaN')
    expect(cloneValue(Number.POSITIVE_INFINITY)).toBe('Infinity')
    expect(cloneValue(10n)).toBe('10n')
  })

  it('drops functions, symbols and undefined from objects, and nulls them in arrays', () => {
    const value = { a: 1, fn: () => {}, sym: Symbol('x'), missing: undefined }
    expect(cloneValue(value)).toEqual({ a: 1 })
    expect(cloneValue([1, () => {}, undefined])).toEqual([1, null, null])
  })

  it('clips long strings with the marker', () => {
    const cloned = cloneValue({ text: 'x'.repeat(LIMITS.stringLength + 50) }) as { text: string }
    expect(cloned.text).toHaveLength(LIMITS.stringLength)
    expect(cloned.text.endsWith('…')).toBe(true)
  })

  it('caps entries and says how many were left out', () => {
    const many = Array.from({ length: LIMITS.entries + 5 }, (_, index) => index)
    const cloned = cloneValue(many) as unknown[]
    expect(cloned).toHaveLength(LIMITS.entries + 1)
    expect(cloned.at(-1)).toBe(`… 5 more`)

    const wide = Object.fromEntries(
      Array.from({ length: LIMITS.entries + 3 }, (_, i) => [`k${i}`, i]),
    )
    const clonedWide = cloneValue(wide) as Record<string, unknown>
    expect(clonedWide['…']).toBe('… 3 more')
  })

  it('stops at the depth limit', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } }
    expect(cloneValue(deep)).toEqual({ a: { b: { c: { d: '…' } } } })
  })

  it('marks cycles instead of looping', () => {
    const cycle: Record<string, unknown> = { name: 'cycle' }
    cycle.self = cycle

    expect(cloneValue(cycle)).toEqual({ name: 'cycle', self: '…' })
  })

  it('reads getters that throw as missing, not as an error', () => {
    const hostile = {
      ok: 1,
      get boom(): never {
        throw new Error('app code')
      },
    }

    expect(cloneValue(hostile)).toEqual({ ok: 1 })
  })

  it('stops adding entries once the character budget is spent', () => {
    const budget = { nodes: 2_000, chars: 40 }
    const cloned = cloneValue({ a: 'x'.repeat(30), b: 'y'.repeat(30), c: 'z' }, budget)
    expect(cloned).toMatchObject({ a: expect.any(String) })
    expect(Object.keys(cloned as object)).not.toContain('c')
  })

  it('produces valid JSON for everything a component can hold', () => {
    const nasty = {
      big: 10n,
      nan: Number.NaN,
      when: new Date('2026-01-02T03:04:05Z'),
      list: [undefined, () => {}, Symbol('s')],
      nested: { deep: { deeper: { deepest: true } } },
      map: new Map([['a', 1]]),
      set: new Set([1]),
      text: 'quote " and \\ backslash',
    }

    expect(() => JSON.parse(cloneToJson(nasty))).not.toThrow()
    expect(json(nasty)).toMatchObject({ big: '10n', nan: 'NaN', list: [null, null, null] })
  })

  it('never returns invalid JSON, even for undefined or a throwing getter', () => {
    expect(cloneToJson(undefined)).toBe('null')
    expect(
      cloneToJson({
        get boom(): never {
          throw new Error('nope')
        },
      }),
    ).toBe('{}')
  })

  it('shares one budget across a whole inspection', () => {
    const budget = createBudget()
    budget.chars = 50

    const first = json({ a: 'x'.repeat(100), b: 'y'.repeat(100) })
    expect(cloneToJson({ a: 'x'.repeat(100), b: 'y'.repeat(100) }, budget)).toBe(
      JSON.stringify({ a: 'x'.repeat(100), '…': '… 1 more' }),
    )

    // The second clone sees an exhausted budget and refuses to walk in.
    expect(cloneToJson({ text: 'y'.repeat(100) }, budget)).toBe('"…"')
    expect(first).toMatchObject({ a: 'x'.repeat(100) })
  })
})

describe('version', () => {
  it('matches package.json until virtual:sphere/config carries it', () => {
    expect(VERSION).toBe(packageVersion)
  })
})
