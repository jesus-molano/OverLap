// Announces a release in Discord from the text written for it in the release's notes. It never
// writes that text: without a whole section it fails and posts nothing. Plain Node, no dependencies.
// It runs in the public repository (.github/workflows/discord-release.yml), and by hand:
//
//   node .github/scripts/discord-release.mjs notes.md v2.9.0         checks and prints the message
//   node .github/scripts/discord-release.mjs notes.md v2.9.0 --post  sends it to $DISCORD_WEBHOOK
//
// The section sits in the notes as an HTML comment, so GitHub's release page and the app's
// “What’s new”, which both read the rendered notes, never show it:
//
//   <!-- discord-announcement
//   [es]
//   # OverLap 2.9.0: the title, which must name this version
//   A short intro, which may wrap.
//
//   - **A change** in a natural sentence, which may wrap
//     on an indented line.
//
//   [en]
//   ...
//   -->
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const RELEASES = 'https://github.com/jesus-molano/OverLap/releases'
const AMBER = 0xffc400
const IS_COMPONENTS_V2 = 1 << 15
/** Discord's limit for all the text in one message. */
const MAX_TEXT = 4000
const LANGUAGES = {
  es: { download: 'Descargar', notes: 'Notas de la versión' },
  en: { download: 'Download', notes: 'Release notes' }
}

const OPEN = /^<!-- discord-announcement[ \t]*$/gm
const CLOSE = /^-->[ \t]*$/m

/** One language's lines as its title, intro and items, or an error for that language. */
function parseLanguage(lang, lines, version) {
  const text = lines.filter((line) => line.trim() !== '')
  const title = /^# (.+)$/.exec(text[0] ?? '')?.[1]?.trim()
  if (!title) throw new Error(`[${lang}] must start with a "# " title line`)
  if (!title.includes(version)) throw new Error(`[${lang}]'s title does not name ${version}`)

  const intro = []
  const items = []
  for (const line of text.slice(1)) {
    if (line.startsWith('- ')) items.push(line.slice(2).trim())
    else if (/^\s/.test(line) && items.length > 0) items[items.length - 1] += ` ${line.trim()}`
    else if (items.length === 0 && !line.startsWith('#')) intro.push(line.trim())
    else throw new Error(`[${lang}] has a line out of place: ${line.trim()}`)
  }
  if (intro.length === 0) throw new Error(`[${lang}] has no intro`)
  if (items.length === 0) throw new Error(`[${lang}] has no items`)
  return { title, intro: intro.join(' '), items }
}

/** The announcement in a release's notes, or an error saying what is wrong. Never a guess. */
export function parseAnnouncement(body, version) {
  const notes = body.replace(/\r\n/g, '\n')
  const opens = [...notes.matchAll(OPEN)]
  if (opens.length === 0) throw new Error('the notes have no <!-- discord-announcement section')
  if (opens.length > 1) throw new Error('the notes have more than one discord-announcement section')

  const start = opens[0].index + opens[0][0].length
  const close = CLOSE.exec(notes.slice(start))
  if (!close) throw new Error('the discord-announcement section has no --> line of its own')
  const inner = notes.slice(start, start + close.index)
  // GitHub would end the comment there and show the rest on the release page and in the app.
  if (inner.includes('-->')) throw new Error('the discord-announcement section contains "-->"')

  const blocks = {}
  let current = null
  for (const line of inner.split('\n')) {
    const header = /^\[([a-z]+)\]\s*$/.exec(line)
    if (header) {
      current = header[1]
      if (!(current in LANGUAGES)) throw new Error(`[${current}] is not a language it announces in`)
      if (blocks[current]) throw new Error(`[${current}] appears twice`)
      blocks[current] = []
    } else if (current) blocks[current].push(line)
    else if (line.trim() !== '') throw new Error(`text before the first language: ${line.trim()}`)
  }
  return Object.fromEntries(
    Object.keys(LANGUAGES).map((lang) => {
      if (!blocks[lang]) throw new Error(`the section has no [${lang}] text`)
      return [lang, parseLanguage(lang, blocks[lang], version)]
    })
  )
}

/** The webhook's body: one amber container per language, Spanish first. */
export function buildMessage(announcement, version) {
  const button = (label, url) => ({ type: 2, style: 5, label, url })
  const components = Object.entries(LANGUAGES).map(([lang, labels]) => {
    const { title, intro, items } = announcement[lang]
    return {
      type: 17,
      accent_color: AMBER,
      components: [
        { type: 10, content: `# ${title}\n${intro}` },
        { type: 10, content: items.map((item) => `- ${item}`).join('\n') },
        {
          type: 1,
          components: [
            button(labels.download, `${RELEASES}/latest`),
            button(labels.notes, `${RELEASES}/tag/v${version}`)
          ]
        }
      ]
    }
  })
  const length = components
    .flatMap((container) => container.components)
    .reduce((sum, c) => sum + (c.content?.length ?? 0), 0)
  if (length > MAX_TEXT) throw new Error(`the text is ${length} characters, over ${MAX_TEXT}`)
  // No mention in the text may ever ping anyone.
  return { flags: IS_COMPONENTS_V2, allowed_mentions: { parse: [] }, components }
}

/** Sends the message. Nothing it prints may contain the webhook's URL, which is a credential. */
async function post(webhook, message) {
  let url
  try {
    url = new URL(webhook)
  } catch {
    throw new Error('DISCORD_WEBHOOK is not a URL')
  }
  if (
    !/^(discord|discordapp)\.com$/.test(url.hostname) ||
    !url.pathname.startsWith('/api/webhooks/')
  )
    throw new Error('DISCORD_WEBHOOK is not a Discord webhook')
  url.search = '?wait=true&with_components=true'

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(30_000)
    })
  } catch (error) {
    throw new Error(`Discord could not be reached (${error.cause?.code ?? error.name})`, {
      cause: error
    })
  }
  if (!response.ok) throw new Error(`Discord said ${response.status}: ${await response.text()}`)
  console.log(`Posted to Discord, message ${(await response.json()).id}.`)
}

async function main([file, tag, flag]) {
  const version = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? '')?.[1]
  if (!file || !version || (flag && flag !== '--post'))
    throw new Error('usage: discord-release.mjs <notes file> <v1.2.3 tag> [--post]')

  const message = buildMessage(parseAnnouncement(fs.readFileSync(file, 'utf8'), version), version)
  if (flag !== '--post') {
    console.log(JSON.stringify(message, null, 2))
    return
  }
  if (!process.env.DISCORD_WEBHOOK) throw new Error('DISCORD_WEBHOOK is not set')
  await post(process.env.DISCORD_WEBHOOK, message)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`No announcement was posted: ${error.message}`)
    process.exit(1)
  })
}
