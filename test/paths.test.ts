import { describe, expect, it } from 'vitest'
import {
  absolutePath,
  baseName,
  isAbsolutePath,
  normalizePath,
  relativeTo,
} from '../src/shared/paths.js'

describe('path helpers', () => {
  it('normalises both separators and recognises absolute forms', () => {
    expect(normalizePath('C:\\app\\src\\App.svelte')).toBe('C:/app/src/App.svelte')
    expect(isAbsolutePath('/app/src/App.svelte')).toBe(true)
    expect(isAbsolutePath('C:/app/src/App.svelte')).toBe(true)
    expect(isAbsolutePath('//server/share/App.svelte')).toBe(true)
    expect(isAbsolutePath('src/App.svelte')).toBe(false)
  })

  it('takes the basename across separators and drops a query', () => {
    expect(baseName('C:\\app\\src\\Chip.svelte')).toBe('Chip.svelte')
    expect(baseName('/app/src/Chip.svelte?t=1')).toBe('Chip.svelte')
    expect(baseName('Chip.svelte')).toBe('Chip.svelte')
  })
})

describe('absolutePath', () => {
  it('resolves a name Svelte reported relative to the working directory', () => {
    expect(absolutePath('/repo', 'apps/web/src/App.svelte')).toBe('/repo/apps/web/src/App.svelte')
    expect(absolutePath('/repo/', './src/App.svelte')).toBe('/repo/src/App.svelte')
    expect(absolutePath('C:\\repo', 'src\\App.svelte')).toBe('C:/repo/src/App.svelte')
  })

  it('leaves absolute paths and an empty base alone', () => {
    expect(absolutePath('/repo', '/repo/src/App.svelte')).toBe('/repo/src/App.svelte')
    expect(absolutePath(undefined, 'src/App.svelte')).toBe('src/App.svelte')
    expect(absolutePath('', 'src/App.svelte')).toBe('src/App.svelte')
  })
})

describe('relativeTo', () => {
  it('relativises POSIX paths, with or without a trailing root slash', () => {
    expect(relativeTo('/app')('/app/src/App.svelte')).toBe('src/App.svelte')
    expect(relativeTo('/app/')('/app/src/App.svelte')).toBe('src/App.svelte')
    expect(relativeTo('/app')('src/App.svelte')).toBe('src/App.svelte')
    expect(relativeTo('/')('/app/src/App.svelte')).toBe('app/src/App.svelte')
  })

  it('relativises Windows paths case-insensitively on the drive', () => {
    expect(relativeTo('C:\\app')('C:/app/src/App.svelte')).toBe('src/App.svelte')
    expect(relativeTo('c:/app')('C:/app/src/App.svelte')).toBe('src/App.svelte')
    expect(relativeTo('C:\\app')('C:\\app\\src\\App.svelte')).toBe('src/App.svelte')
  })

  it('never prints an absolute path outside the project', () => {
    expect(relativeTo('/app')('/elsewhere/node_modules/pkg/Chip.svelte')).toBe(
      'external/Chip.svelte',
    )
    expect(relativeTo('C:\\app')('D:/other/Chip.svelte')).toBe('external/Chip.svelte')
    expect(relativeTo(undefined)('/home/me/app/src/App.svelte')).toBe('external/App.svelte')
  })

  it('strips query and fragment from every displayed path', () => {
    expect(relativeTo('/app')('/app/src/App.svelte?t=1#x')).toBe('src/App.svelte')
    expect(relativeTo('/app')('src/App.svelte?t=1')).toBe('src/App.svelte')
  })
})
