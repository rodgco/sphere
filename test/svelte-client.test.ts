import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as client from 'svelte/internal/client'
import {
  REQUIRED_EXPORTS,
  installInstrumentation,
  isInstrumentationInstalled,
} from '../src/runtime/instrumentation.js'
import {
  WRAPPER_URL,
  isAppModule,
  runtimeSource,
  wrapperModule,
} from '../src/plugin/svelte-client.js'

const upstreamId = '/app/node_modules/svelte/src/internal/client/index.js'

describe('wrapperModule', () => {
  const text = wrapperModule(upstreamId)

  it('re-exports the whole upstream surface from the resolved file', () => {
    expect(text).toContain(`export * from "${upstreamId}"`)
    expect(text).toContain(`import * as __sphereUpstream from "${upstreamId}"`)
  })

  it('imports the instrumentation through its virtual specifier', () => {
    expect(text).toContain('from "virtual:sphere/instrumentation"')
  })

  it('shadows exactly the wrapped bindings and no others', () => {
    expect(text).toContain('export const { push, pop, add_svelte_meta, add_locations, tag')
    expect(text).toContain('component, each } = __sphere')
    // `if` and `key` are reserved words: exported under their real names, bound under others.
    expect(text).toContain('const { if: __sphere_if, key: __sphere_key } = __sphere')
    expect(text).toContain('export { __sphere_if as if, __sphere_key as key }')
  })

  it('contains no branch: the decision was made when the module was built', () => {
    expect(text).toContain('const __sphere = installInstrumentation(__sphereUpstream)')
    expect(text).not.toMatch(/\bif\s*\(/)
  })

  it('is deterministic, so two dev servers serve the same module', () => {
    expect(wrapperModule(upstreamId)).toBe(text)
  })

  it('never imports the bare upstream specifier, which would recurse', () => {
    expect(text).not.toContain('from "svelte/internal/client"')
  })
})

describe('isAppModule', () => {
  const root = '/project'

  it('accepts files inside the project, with or without a query', () => {
    expect(isAppModule('/project/src/App.svelte', root)).toBe(true)
    expect(isAppModule('/project/src/lib/deep/Thing.ts?x=1', root)).toBe(true)
  })

  it('rejects anything under node_modules, including Vite deps', () => {
    expect(isAppModule('/project/node_modules/svelte/src/attachments/index.js', root)).toBe(false)
    expect(isAppModule('/project/node_modules/.vite/deps/svelte.js', root)).toBe(false)
  })

  it('rejects files outside the project and non-file importers', () => {
    expect(isAppModule('/elsewhere/App.svelte', root)).toBe(false)
    expect(isAppModule(undefined, root)).toBe(false)
    expect(isAppModule('src/App.svelte', root)).toBe(false)
    expect(isAppModule('\0virtual:mine', root)).toBe(false)
  })
})

describe('runtimeSource', () => {
  it('reaches the shipped source from both src/ and dist/', () => {
    const path = runtimeSource('instrumentation')
    expect(path.endsWith('/src/runtime/instrumentation.ts')).toBe(true)
    expect(existsSync(path)).toBe(true)
  })
})

describe('installInstrumentation', () => {
  it('accepts the contract the installed Svelte fulfils', () => {
    const names = REQUIRED_EXPORTS as readonly string[]
    expect(names.every((name) => typeof client[name] === 'function')).toBe(true)
    expect(() => installInstrumentation(client as Record<string, unknown>)).not.toThrow()
  })

  it('warns once per upstream namespace, naming what is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const upstream = { push: () => {}, pop: () => {} }

    installInstrumentation(upstream)
    installInstrumentation(upstream)

    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).toContain('missing ')
    expect(message).toContain('add_locations')
    expect(message).toContain('Instrumentation is off')
  })

  it('returns one wrapper per required binding, and the same record on re-install', () => {
    const overrides = installInstrumentation(client as Record<string, unknown>)
    const again = installInstrumentation(client as Record<string, unknown>)

    expect(Object.keys(overrides).toSorted()).toEqual([...REQUIRED_EXPORTS].toSorted())
    expect(Object.values(overrides).every((value) => typeof value === 'function')).toBe(true)
    expect(again).toBe(overrides)
    expect(isInstrumentationInstalled()).toBe(true)
    // Every wrapper is a different function than the upstream one it replaces.
    for (const name of REQUIRED_EXPORTS) {
      expect(overrides[name]).not.toBe((client as Record<string, unknown>)[name])
    }
  })

  it('falls back to upstream bindings when the surface is incomplete', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const upstream = Object.fromEntries(
      REQUIRED_EXPORTS.map((name) => [name, client[name]]),
    ) as Record<string, unknown>
    delete upstream.add_locations

    const overrides = installInstrumentation(upstream)

    // The generated wrapper exports these names locally; they must not be `undefined`.
    for (const name of REQUIRED_EXPORTS) expect(overrides[name]).toBe(upstream[name])
    expect(overrides.add_locations).toBeUndefined()
    expect(isInstrumentationInstalled()).toBe(true)
    warn.mockRestore()
  })

  it('degrades instead of throwing when the module is nothing like Svelte', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => installInstrumentation({})).not.toThrow()
    expect(() =>
      installInstrumentation(Object.create(null) as Record<string, unknown>),
    ).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('wrapper url', () => {
  it('encodes the null byte the way Vite addresses it', () => {
    expect(WRAPPER_URL).toBe('/@id/__x00__virtual:sphere/svelte-client')
  })
})
