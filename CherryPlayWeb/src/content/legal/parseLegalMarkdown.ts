export type LegalBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

const ATX_HEADING = /^(#{2,3})\s+(.+?)\s*$/;
const SECTION_HEADING = /^(\d+)(?:\.(\d+))?\.(\s+)(.+)$/;
const UNORDERED_ITEM = /^[—–\-*]\s+(.+)$/;
const ORDERED_ITEM = /^\d+[.)]\s+(.+)$/;

function matchNumberedSection(line: string): RegExpMatchArray | null {
  return line.match(SECTION_HEADING);
}

function isTitleLikeHeading(line: string): { level: 2 | 3; text: string } | null {
  const atx = line.match(ATX_HEADING);
  if (atx) {
    return { level: atx[1].length === 2 ? 2 : 3, text: atx[2].trim() };
  }

  const numbered = matchNumberedSection(line);
  if (!numbered) {
    return null;
  }

  const hasSubsection = numbered[2] !== undefined;
  const title = numbered[4].trim();
  // Standalone section titles stay short; long same-line bodies stay paragraphs.
  if (title.length > 90) {
    return null;
  }

  return { level: hasSubsection ? 3 : 2, text: `${numbered[1]}${hasSubsection ? `.${numbered[2]}` : ''}. ${title}` };
}

function isUnorderedItem(line: string): string | null {
  const match = line.match(UNORDERED_ITEM);
  return match ? match[1].trim() : null;
}

function isOrderedItem(line: string): string | null {
  // Avoid treating "1. Title" section headings as ordered list items.
  if (isTitleLikeHeading(line)) {
    return null;
  }
  const match = line.match(ORDERED_ITEM);
  return match ? match[1].trim() : null;
}

/**
 * Parses plain legal markdown into headings, paragraphs, and lists.
 * Numbered section lines (`1. …`, `8.4. …`) become h2/h3 when title-like;
 * `##` / `###` are supported; `—` / `-` / `*` lines become unordered lists.
 */
export function parseLegalMarkdown(body: string): LegalBlock[] {
  const lines = body
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n');

  const blocks: LegalBlock[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      blocks.push({ type: 'paragraph', text });
    }
    buf.length = 0;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const heading = isTitleLikeHeading(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, text: heading.text });
      i += 1;
      continue;
    }

    const unordered = isUnorderedItem(line);
    if (unordered !== null) {
      const items: string[] = [unordered];
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) {
          break;
        }
        const item = isUnorderedItem(next);
        if (item === null) {
          break;
        }
        items.push(item);
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    const ordered = isOrderedItem(line);
    if (ordered !== null) {
      const items: string[] = [ordered];
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) {
          break;
        }
        const item = isOrderedItem(next);
        if (item === null) {
          break;
        }
        items.push(item);
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Numbered clause with long same-line body → its own paragraph (do not glue 2.1/2.2).
    if (matchNumberedSection(line)) {
      blocks.push({ type: 'paragraph', text: line });
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) {
        break;
      }
      if (
        isTitleLikeHeading(next) ||
        matchNumberedSection(next) ||
        isUnorderedItem(next) !== null ||
        isOrderedItem(next) !== null
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    flushParagraph(paragraphLines);
  }

  return blocks;
}

/** Flattens body into blank-line paragraphs (legacy / operator). */
export function markdownBodyToParagraphs(body: string): string[] {
  return parseLegalMarkdown(body)
    .filter((block): block is Extract<LegalBlock, { type: 'paragraph' }> => block.type === 'paragraph')
    .map((block) => block.text);
}
