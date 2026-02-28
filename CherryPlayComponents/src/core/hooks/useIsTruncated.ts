import { useEffect, useState } from 'react';

/**
 * Returns true when the element's content overflows (scrollWidth > clientWidth).
 * Used to show a clickable ellipsis only when the text is actually truncated.
 * @param ref Ref to the element that displays the (possibly truncated) text.
 * @param enabled When false, does not measure and returns false (e.g. when expanded).
 * @param contentKey When this changes (e.g. display name or stable id), the effect re-runs and re-measures so truncation is updated when the visible text changes.
 */
export function useIsTruncated(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey?: string,
): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) {
      setIsTruncated(false);
      return;
    }

    const el = ref.current;

    const check = (): void => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, contentKey]);

  return isTruncated;
}
