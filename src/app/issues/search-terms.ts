/** Structured `key:value` terms in an issue search, such as is:resolved or assigned:me. */

const isTerm = (key: string) => (token: string) => token.startsWith(`${key}:`);

// Words of a search, keeping a quoted part ("browser":"Mobile Safari") in one word
const words = (query: string | null | undefined) =>
  (query ?? "").match(/(?:[^\s"]+|"(?:\\.|[^"\\])*"?)+/g) ?? [];

/** Every value of key: in a query, in order. */
export function termValues(
  query: string | null | undefined,
  key: string,
): string[] {
  return words(query)
    .filter(isTerm(key))
    .map((token) => token.slice(key.length + 1))
    .filter(Boolean);
}
