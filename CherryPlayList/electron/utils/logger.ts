class Logger {
  private isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  debug(message: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error, ...args);
    } else {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  }
}

export const logger = new Logger();
