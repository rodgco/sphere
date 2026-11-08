import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as client from 'svelte/internal/client'
import { REQUIRED_EXPORTS, installInstrumentation } from '../src/runtime/instrumentation.js'
import { WRAPPER_URL, runtimeSource, wrapperModule } from '../src/plugin/svelte-client.js'

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

  it('contains no branch: the decision was made when the module was built', () => {
    expect(text).toContain('installInstrumentation(__sphereUpstream)')
    expect(text).not.toMatch(/\bif\s*\(/)
  })

  it('is deterministic, so two dev servers serve the same module', () => {
    expect(wrapperModule(upstreamId)).toBe(text)
  })

  it('never imports the bare upstream specifier, which would recurse', () => {
    expect(text).not.toContain('from "svelte/internal/client"')
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
