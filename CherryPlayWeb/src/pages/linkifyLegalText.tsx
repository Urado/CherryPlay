import type { ReactNode } from 'react';

const LINKABLE =
  /(https:\/\/[^\s<>"'）)]+|mailto:[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

const TRAILING_PUNCT = /[;.,:)]+$/;

const splitTrailingPunctuation = (value: string): { core: string; trailing: string } => {
  const match = TRAILING_PUNCT.exec(value);
  if (!match || match.index === 0) {
    return { core: value, trailing: '' };
  }
  return { core: value.slice(0, match.index), trailing: match[0] };
};

export const linkifyLegalText = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  LINKABLE.lastIndex = 0;

  while ((match = LINKABLE.exec(text)) !== null) {
    const value = match[0];
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const { core, trailing } = splitTrailingPunctuation(value);
    const href = core.startsWith('http')
      ? core
      : core.startsWith('mailto:')
        ? core
        : `mailto:${core}`;
    const label = core.startsWith('mailto:') ? core.slice('mailto:'.length) : core;

    nodes.push(
      <a key={`${match.index}-${core}`} href={href}>
        {label}
      </a>,
    );
    if (trailing) {
      nodes.push(trailing);
    }
    lastIndex = match.index + value.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
};
