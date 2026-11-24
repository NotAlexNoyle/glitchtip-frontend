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

/** The value of the first key: term in a query, or null when there is none. */
export function termValue(
  query: string | null | undefined,
  key: string,
): string | null {
  return termValues(query, key)[0] ?? null;
}

/** The query with its key: terms replaced by one, or removed when value is null. */
export function withTerm(
  query: string | null | undefined,
  key: string,
  value: string | null,
): string {
  const kept = words(query).filter((t) => !isTerm(key)(t));
  if (!value) return kept.join(" ");
  // Structured terms go before bare words; the backend stops at the first word.
  const firstWord = kept.findIndex((t) => !t.includes(":"));
  const at = firstWord < 0 ? kept.length : firstWord;
  kept.splice(at, 0, `${key}:${value}`);
  return kept.join(" ");
}
