import { load } from 'js-yaml'

// Free-text keys that iRacing writes unquoted (the same set pyirsdk quotes).
// Groups: indentation incl. any '- ' list marker, key, value without trailing blanks.
const FREE_TEXT_RE =
  /^([ \t]*(?:-[ \t]+)*)(UserName|TeamName|AbbrevName|Initials|DriverSetupName):(?:[ \t]+(.*?))?[ \t]*$/

const SINGLE_QUOTED_RE = /^'(?:[^']|'')*'$/
const DOUBLE_QUOTED_RE = /^"(?:[^"\\]|\\.)*"$/

// C0 controls except \t and \n (\r too), DEL, C1, U+FFFE/U+FFFF and lone surrogates
// (with the u flag a surrogate range only matches unpaired halves): js-yaml rejects them.
// eslint-disable-next-line no-control-regex
const NON_PRINTABLE_RE = /[\x00-\x08\x0B-\x1F\x7F-\x9F￾￿\uD800-\uDFFF]/gu

function quoteValue(value: string): string {
  if (SINGLE_QUOTED_RE.test(value) || DOUBLE_QUOTED_RE.test(value)) return value
  return `'${value.replaceAll("'", "''")}'`
}

/**
 * Makes the iRacing session YAML loadable when driver names break it
 * ("Foo: Bar", "@name", "- x"...): drops non-printable characters, quotes the
 * free-text keys and, like irsdk-node, turns ': ,' into ': 0,'.
 */
export function sanitizeSessionYaml(text: string): string {
  const lines = text.replace(NON_PRINTABLE_RE, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = FREE_TEXT_RE.exec(line)
    lines[i] = m
      ? `${m[1] ?? ''}${m[2] ?? ''}: ${quoteValue(m[3] ?? '')}`
      : line.replaceAll(': ,', ': 0,')
  }
  return lines.join('\n')
}

/**
 * Fallback for when irsdk-node's getSessionData() returns null because
 * js-yaml threw. Returns the loaded document, or null on any error (and for
 * an empty document).
 */
export function parseSessionYaml(text: string): unknown {
  try {
    return load(sanitizeSessionYaml(text), { json: true }) ?? null
  } catch {
    return null
  }
}
