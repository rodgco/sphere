import { describe, expect, it, vi } from 'vitest'
import {
  CONTROL_KEY,
  DEFAULT_OPTIONS,
  OPTIONS_KEY,
  readControl,
  readOptions,
  safeStorage,
  writeControl,
  writeOptions,
} from '../src/overlay/storage.js'

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }
}

describe('control position', () => {
  it('round-trips a position', () => {
    const storage = new MemoryStorage()
    writeControl({ x: 12, y: 34 }, storage)

    expect(storage.getItem(CONTROL_KEY)).toBe('{"x":12,"y":34}')
    expect(readControl(storage)).toEqual({ x: 12, y: 34 })
  })

  it('forgets the position when written as null', () => {
    const storage = new MemoryStorage()
    writeControl({ x: 1, y: 2 }, storage)
    writeControl(null, storage)

    expect(storage.getItem(CONTROL_KEY)).toBeNull()
    expect(readControl(storage)).toBeNull()
  })

  it('falls back to the default corner for anything invalid', () => {
    for (const raw of ['not json', '[]', '{"x":1}', '{"x":"1","y":2}', '{"x":null,"y":2}', '7']) {
      const storage = new MemoryStorage()
      storage.setItem(CONTROL_KEY, raw)
      expect(readControl(storage), raw).toBeNull()
    }
  })

  it('survives a storage that throws', () => {
    const hostile = new MemoryStorage()
    hostile.setItem = () => {
      throw new Error('quota')
    }
    hostile.getItem = () => {
      throw new Error('denied')
    }

    expect(() => writeControl({ x: 1, y: 1 }, hostile)).not.toThrow()
    expect(readControl(hostile)).toBeNull()
  })
})

describe('options', () => {
  it('defaults to everything on', () => {
    expect(readOptions(new MemoryStorage())).toEqual(DEFAULT_OPTIONS)
  })

  it('round-trips and fills missing keys', () => {
    const storage = new MemoryStorage()
    storage.setItem(OPTIONS_KEY, '{"state":false,"template":true}')

    expect(readOptions(storage)).toEqual({ ...DEFAULT_OPTIONS, state: false })
  })

  it('ignores non-boolean values', () => {
    const storage = new MemoryStorage()
    storage.setItem(OPTIONS_KEY, '{"props":"yes","source":null}')

    expect(readOptions(storage)).toEqual(DEFAULT_OPTIONS)
  })

  it('writes what it reads', () => {
    const storage = new MemoryStorage()
    const options = { ...DEFAULT_OPTIONS, props: false }
    writeOptions(options, storage)

    expect(JSON.parse(storage.getItem(OPTIONS_KEY) ?? '{}')).toEqual(options)
    expect(readOptions(storage)).toEqual(options)
  })
})

describe('safeStorage', () => {
  it('is undefined outside a browser', () => {
    expect(safeStorage()).toBeUndefined()
  })

  it("probes without writing to the host app's storage", () => {
    const storage = new MemoryStorage()
    const set = vi.spyOn(storage, 'setItem')
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    try {
      expect(safeStorage()).toBe(storage)
      expect(set).not.toHaveBeenCalled()
    } finally {
      if (descriptor === undefined) delete (globalThis as { localStorage?: Storage }).localStorage
      else Object.defineProperty(globalThis, 'localStorage', descriptor)
    }
  })
})
