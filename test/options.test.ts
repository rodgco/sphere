import { describe, expect, it } from 'vitest'
import { sphere } from '../src/plugin/index.js'
import { resolveOptions } from '../src/plugin/options.js'

describe('resolveOptions', () => {
  it('enables the plugin when no option is given', () => {
    expect(resolveOptions(undefined)).toEqual({
      enabled: true,
      instrumentation: true,
      theme: { mode: 'auto', tokens: {} },
    })
    expect(resolveOptions({})).toEqual({
      enabled: true,
      instrumentation: true,
      theme: { mode: 'auto', tokens: {} },
    })
  })

  it('honours an explicit switch', () => {
    expect(resolveOptions({ enabled: false })).toEqual({
      enabled: false,
      instrumentation: true,
      theme: { mode: 'auto', tokens: {} },
    })
    expect(resolveOptions({ instrumentation: false })).toEqual({
      enabled: true,
      instrumentation: false,
      theme: { mode: 'auto', tokens: {} },
    })
  })

  it('names an unknown option', () => {
    expect(() => resolveOptions({ maxSelection: 3 } as never)).toThrow(
      /unknown option "maxSelection"/,
    )
  })

  it('rejects a non-object', () => {
    expect(() => resolveOptions([] as never)).toThrow(/options must be an object/)
    expect(() => resolveOptions(null as never)).toThrow(/options must be an object/)
  })

  it('rejects a non-boolean switch', () => {
    expect(() => resolveOptions({ enabled: 'yes' } as never)).toThrow(/must be a boolean/)
    expect(() => resolveOptions({ instrumentation: 'no' } as never)).toThrow(/must be a boolean/)
  })
})

describe('plugin shape', () => {
  const [plugin] = sphere()

  it('is serve-only', () => {
    expect(plugin?.name).toBe('sphere')
    expect(plugin?.apply).toBe('serve')
  })

  it('is client-only', () => {
    const applyToEnvironment = plugin?.applyToEnvironment
    expect(typeof applyToEnvironment).toBe('function')
    expect(applyToEnvironment?.call(plugin, { config: { consumer: 'client' } } as never)).toBe(true)
    expect(applyToEnvironment?.call(plugin, { config: { consumer: 'server' } } as never)).toBe(
      false,
    )
  })
})
