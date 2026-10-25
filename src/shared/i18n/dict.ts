/**
 * The shape every other language must match, derived from the Spanish
 * dictionary (`as const`): the same keys, any string for a string, the same
 * parameters for a function (plurals and sentences with values are
 * functions), nested groups alike. A missing or extra key, or a function
 * where a string is expected, is a type error.
 */
export type Dict<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : T[K] extends readonly string[]
        ? readonly string[]
        : Dict<T[K]>
}
