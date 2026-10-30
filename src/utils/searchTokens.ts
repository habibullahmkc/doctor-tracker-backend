export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Lower-cased, de-duplicated words used for index-backed prefix search.
 * "Dr. Sarah Ahmed", "Square Hospital" → ["dr", "sarah", "ahmed", "square", "hospital"]
 */
export function toTokens(...parts: Array<string | null | undefined>) {
  const words = parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .split(/[\s@.,()\-_/+]+/)
    .filter(Boolean);
  return [...new Set(words)];
}

/**
 * Every search term must prefix-match one of the document's tokens.
 * Anchored regexes (^term) can use the multikey index on `searchTokens`,
 * unlike unanchored /term/i which forces a collection scan.
 */
export function buildSearchFilter(search?: string) {
  const terms = search
    ?.trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  if (!terms?.length) return {};
  return { searchTokens: { $all: terms.map((term) => new RegExp(`^${escapeRegex(term)}`)) } };
}
