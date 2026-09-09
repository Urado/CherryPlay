/** Split clean legal markdown into paragraphs (blank-line separated). No YAML. */
export function markdownBodyToParagraphs(body: string): string[] {
  return body
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
