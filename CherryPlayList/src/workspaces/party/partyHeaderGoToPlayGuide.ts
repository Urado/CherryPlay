export const PARTY_HEADER_GUIDE_TARGET_ATTR = 'data-party-header-guide-target';
export const PARTY_HEADER_GUIDE_TARGET_START = 'start-playback';
export const PARTY_HEADER_GUIDE_TARGET_RESUME = 'resume-playback';
export const PARTY_HEADER_GUIDE_HIGHLIGHT_CLASS = 'party-header-guide-highlight';
export const PARTY_HEADER_GUIDE_HIGHLIGHT_MS = 5000;
export const PARTY_GO_TO_PLAY_GUIDE_PANEL_WIDTH = 280;

export type PartyHeaderGuideTargetKind =
  | typeof PARTY_HEADER_GUIDE_TARGET_START
  | typeof PARTY_HEADER_GUIDE_TARGET_RESUME;

export function resolvePartyHeaderGuideTargetKind(input: {
  primaryStatus: string;
  streamingSource: string;
}): PartyHeaderGuideTargetKind {
  if (input.streamingSource === 'aimp') {
    return PARTY_HEADER_GUIDE_TARGET_START;
  }
  if (input.primaryStatus === 'Пауза' || input.primaryStatus === 'Конец') {
    return PARTY_HEADER_GUIDE_TARGET_RESUME;
  }
  return PARTY_HEADER_GUIDE_TARGET_START;
}

export function resolvePartyHeaderGuideStartLabel(streamingSource: string): string {
  return streamingSource === 'aimp' ? 'Включить онлайн' : 'Начать проигрывание';
}

export function findPartyHeaderGuideTarget(kind: PartyHeaderGuideTargetKind): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${PARTY_HEADER_GUIDE_TARGET_ATTR}="${kind}"]`);
}

let highlightTimeoutId: number | null = null;
let highlightedElement: HTMLElement | null = null;

export function clearPartyHeaderGuideHighlight(): void {
  if (highlightTimeoutId != null) {
    window.clearTimeout(highlightTimeoutId);
    highlightTimeoutId = null;
  }
  if (highlightedElement) {
    highlightedElement.classList.remove(PARTY_HEADER_GUIDE_HIGHLIGHT_CLASS);
    highlightedElement = null;
  }
}

export function runPartyHeaderGuideHighlight(target: HTMLElement): void {
  clearPartyHeaderGuideHighlight();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  highlightedElement = target;
  target.classList.add(PARTY_HEADER_GUIDE_HIGHLIGHT_CLASS);
  highlightTimeoutId = window.setTimeout(() => {
    clearPartyHeaderGuideHighlight();
  }, PARTY_HEADER_GUIDE_HIGHLIGHT_MS);
}

export function waitForPartyHeaderGuideTarget(
  kind: PartyHeaderGuideTargetKind,
  options?: { attempts?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<HTMLElement | null> {
  const attempts = options?.attempts ?? 20;
  const intervalMs = options?.intervalMs ?? 50;
  const signal = options?.signal;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    let remaining = attempts;
    let timeoutId: number | null = null;

    const finish = (value: HTMLElement | null) => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };

    const onAbort = () => {
      finish(null);
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    const tryFind = () => {
      if (signal?.aborted) {
        finish(null);
        return;
      }
      const found = findPartyHeaderGuideTarget(kind);
      if (found) {
        finish(found);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        finish(null);
        return;
      }
      timeoutId = window.setTimeout(tryFind, intervalMs);
    };

    tryFind();
  });
}
