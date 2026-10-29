import { type RefObject, useEffect, useState } from 'react';

export const useIsTruncated = (
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey?: string,
): boolean => {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) {
      queueMicrotask(() => setIsTruncated(false));
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
};
