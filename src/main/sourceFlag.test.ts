import { describe, expect, it } from 'vitest'
import { resolveSource } from './sourceFlag'

const EXE = 'C:\\Apps\\OverLap.exe'

describe('resolveSource', () => {
  it('defaults to the real sim on Windows', () => {
    expect(resolveSource([EXE], {}, 'win32')).toBe('iracing')
    expect(resolveSource([EXE], { OVERLAY_SOURCE: 'bogus' }, 'win32')).toBe('iracing')
  })

  it('defaults to mock outside Windows', () => {
    expect(resolveSource(['/usr/bin/overlay'], {}, 'linux')).toBe('mock')
    expect(resolveSource(['/usr/bin/overlay'], { OVERLAY_SOURCE: 'bogus' }, 'darwin')).toBe('mock')
  })

  it('uses the current platform when none is given', () => {
    expect(resolveSource([EXE], {})).toBe(process.platform === 'win32' ? 'iracing' : 'mock')
  })

  it('reads OVERLAY_SOURCE on any platform', () => {
    expect(resolveSource([EXE], { OVERLAY_SOURCE: 'mock' }, 'win32')).toBe('mock')
    expect(resolveSource([EXE], { OVERLAY_SOURCE: ' MOCK ' }, 'win32')).toBe('mock')
    expect(resolveSource([EXE], { OVERLAY_SOURCE: 'iracing' }, 'linux')).toBe('iracing')
  })

  it('lets the CLI flag win over the environment and the platform default', () => {
    expect(resolveSource([EXE, '--mock'], { OVERLAY_SOURCE: 'iracing' }, 'win32')).toBe('mock')
    expect(resolveSource([EXE, '--source=iracing'], { OVERLAY_SOURCE: 'mock' }, 'win32')).toBe(
      'iracing'
    )
    expect(resolveSource([EXE, '--source=mock'], {}, 'win32')).toBe('mock')
    expect(resolveSource([EXE, '--source=iracing'], {}, 'linux')).toBe('iracing')
  })

  it('lets the last flag win', () => {
    expect(resolveSource([EXE, '--mock', '--source=iracing'], {}, 'linux')).toBe('iracing')
    expect(resolveSource([EXE, '--source=iracing', '--mock'], {}, 'win32')).toBe('mock')
  })

  it('ignores invalid --source values', () => {
    expect(resolveSource([EXE, '--source=foo'], { OVERLAY_SOURCE: 'mock' }, 'win32')).toBe('mock')
    expect(resolveSource([EXE, '--mock', '--source=foo'], {}, 'win32')).toBe('mock')
    expect(resolveSource([EXE, '--source=foo'], {}, 'win32')).toBe('iracing')
    expect(resolveSource([EXE, '--source=foo'], {}, 'linux')).toBe('mock')
  })
})
