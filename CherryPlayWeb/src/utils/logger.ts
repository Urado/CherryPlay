/**
 * Логи только в режиме разработки (import.meta.env.DEV).
 * В production вызовы не выполняются.
 */
const isDev = import.meta.env.DEV;

export function devLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}
