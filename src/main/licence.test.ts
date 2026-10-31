/**
 * The licence (31-oct-2026): OverLap is GPL-3.0-or-later, and every file that names the licence
 * says so. The colour car logos stay, but as third-party artwork the GPL does not cover: the
 * notices, the README and the file itself say it.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (file: string): string => readFileSync(resolve(ROOT, file), 'utf8')

describe('the licence', () => {
  it('is the unmodified GPL-3.0 text (what GitHub recognises)', () => {
    const md5 = createHash('md5')
      .update(readFileSync(resolve(ROOT, 'LICENSE')))
      .digest('hex')
    // https://www.gnu.org/licenses/gpl-3.0.txt
    expect(md5).toBe('1ebbd3e34237af26da5dc08a4e440464')
  })

  it('is named the same in package.json, the exe and the docs', () => {
    const pkg = JSON.parse(read('package.json')) as { license: string; private: boolean }
    expect(pkg.license).toBe('GPL-3.0-or-later')
    expect(pkg.private).toBe(true)
    expect(read('electron-builder.yml')).toMatch(
      /^copyright: Copyright \(C\) 2026 Jesús Molano\. Licensed under GPL-3\.0-or-later\.$/m
    )
    expect(read('THIRD_PARTY_NOTICES.md')).toContain('`GPL-3.0-or-later`')
    expect(read('README.md')).toContain('`GPL-3.0-or-later`')
    // (The notices quote the iRacing SDK's BSD licence, which does say «All rights reserved».)
    for (const file of ['README.md', 'docs/README.dev.md']) {
      expect(read(file), file).not.toMatch(/all rights reserved|derechos reservados/i)
    }
  })

  it('leaves the colour logos out of the GPL, and says where the free set is', () => {
    expect(read('src/renderer/src/ui/brandLogosColor.ts')).toContain('NOT COVERED BY THE GPL')
    const notices = read('THIRD_PARTY_NOTICES.md')
    expect(notices).toMatch(/\*\*NOT\s+covered by OverLap's licence\*\*/)
    expect(notices).toContain('CC0 1.0 Universal')
    expect(notices).toMatch(/section 7\(e\)/)
    expect(read('README.md')).toMatch(/The colour logos of the car makes are not under the GPL/)
    expect(read('README.es.md')).toMatch(/no están bajo la GPL/)
  })
})
