/**
 * Text to Windows-1252 bytes, as iRacing writes its session info: '?' for every character
 * outside the code page ('Иван Петров' -> '???? ??????'). Tests only.
 */
import { decodeCp1252Table } from '../decode'

const BYTE_OF: ReadonlyMap<string, number> = new Map(
  Array.from({ length: 256 }, (_, b) => [decodeCp1252Table(Uint8Array.of(b)), b] as const)
)

const QUESTION_MARK = 0x3f

export function encodeCp1252(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text), (c) => BYTE_OF.get(c) ?? QUESTION_MARK)
}
