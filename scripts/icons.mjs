// Regenerates every icon file from the SVG sources in build/icon-src/ (npm run icons).
// Electron renders each SVG offscreen at its exact pixel size (no scaling of a bigger PNG,
// so the small sizes keep their hand-placed pixels), then:
//   build/icon.ico            exe icon: 16, 24, 32, 48, 64, 128, 256 (PNG entries)
//   build/icon.png            512 px
//   resources/icon.png        256 px, window icon
//   resources/tray/tray-{dark,light}-{16,20,24,32}.png  tray art per display scale
// "dark" art is for a dark taskbar (light glyph), "light" art for a light one.
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'build', 'icon-src')

/** [source svg, pixel size, output file] — the ICO entries are collected separately. */
const OUTPUTS = [
  ['app.svg', 512, 'build/icon.png'],
  ['app.svg', 256, 'resources/icon.png'],
  ['tray-dark.svg', 16, 'resources/tray/tray-dark-16.png'],
  ['tray-dark-20.svg', 20, 'resources/tray/tray-dark-20.png'],
  ['tray-dark-24.svg', 24, 'resources/tray/tray-dark-24.png'],
  ['tray-dark-24.svg', 32, 'resources/tray/tray-dark-32.png'],
  ['tray-light.svg', 16, 'resources/tray/tray-light-16.png'],
  ['tray-light-20.svg', 20, 'resources/tray/tray-light-20.png'],
  ['tray-light-24.svg', 24, 'resources/tray/tray-light-24.png'],
  ['tray-light-24.svg', 32, 'resources/tray/tray-light-32.png']
]
/** Each ICO size from the art drawn for it. */
const ICO = [
  ['app-16.svg', 16],
  ['app-24.svg', 24],
  ['app-small.svg', 32],
  ['app-48.svg', 48],
  ['app.svg', 64],
  ['app.svg', 128],
  ['app.svg', 256]
]

app.disableHardwareAcceleration()
// Each render reuses one window; without this, nothing else may close the app early.
app.on('window-all-closed', () => {})
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'overlap-icons-')))

async function render(win, svgFile, size) {
  const svg = fs.readFileSync(path.join(SRC, svgFile)).toString('base64')
  const html = `<!doctype html><html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${svg}" style="display:block;width:${size}px;height:${size}px"></body></html>`
  const page = path.join(app.getPath('userData'), 'icon.html')
  fs.writeFileSync(page, html)
  await win.loadFile(page)
  await new Promise((resolve) => setTimeout(resolve, 150))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  const actual = img.getSize()
  if (actual.width !== size || actual.height !== size) {
    throw new Error(`${svgFile} rendered at ${actual.width}x${actual.height}, expected ${size}`)
  }
  return img.toPNG()
}

/** An ICO whose entries are PNGs (supported by Windows since Vista). */
function ico(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt8(0, at + 2)
    header.writeUInt8(0, at + 3)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...entries.map((e) => e.png)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, javascript: false }
  })
  try {
    for (const [svg, size, out] of OUTPUTS) {
      const file = path.join(ROOT, out)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, await render(win, svg, size))
      console.log(`[icons] ${out} (${size} px, ${svg})`)
    }
    const entries = []
    for (const [svg, size] of ICO) entries.push({ size, png: await render(win, svg, size) })
    fs.writeFileSync(path.join(ROOT, 'build', 'icon.ico'), ico(entries))
    console.log(`[icons] build/icon.ico (${ICO.map(([, s]) => s).join(', ')})`)
  } catch (err) {
    console.error('[icons] failed:', err)
    process.exitCode = 1
  }
  win.destroy()
  app.quit()
})
