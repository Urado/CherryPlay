/** Minimal frontmatter + body parser for legal markdown mocks (no MD lib). */
export function parseLegalMarkdown(raw: string): { meta: Record<string, string>; body: string } {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: trimmed };
  }

  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    return { meta: {}, body: trimmed };
  }

  const front = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).trim();
  const meta: Record<string, string> = {};

  for (const line of front.split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) {
      continue;
    }
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body };
}

/** Split markdown body into paragraphs (blank-line separated). */
export function markdownBodyToParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
