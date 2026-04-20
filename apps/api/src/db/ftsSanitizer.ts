const FTS5_METACHARTS = /["'()*:\-]/g;

export function sanitizeFtsQuery(raw: string): string | null {
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(FTS5_METACHARTS, ''))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;

  const lastIdx = tokens.length - 1;
  return tokens.map((t, i) => (i === lastIdx ? `"${t}"*` : `"${t}"`)).join(' ');
}
