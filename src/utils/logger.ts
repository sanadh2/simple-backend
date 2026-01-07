import { AsyncLocalStorage } from 'async_hooks';

interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}

interface LogMetadata {
  [key: string]: unknown;
}

interface LogObject {
  timestamp: string;
  level: string;
  correlationId: string;
  message: string;
  userId?: string;
  meta?: LogMetadata;
}

const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private getContext(): LogContext {
    return asyncLocalStorage.getStore() || {};
  }

  private formatMessage(level: LogLevel, message: string, meta?: LogMetadata): string {
    const context = this.getContext();
    const logObject: LogObject = {
      timestamp: this.getTimestamp(),
      level: level.toUpperCase(),
      correlationId: context.correlationId || 'N/A',
      message,
    };

    if (context.userId) {
      logObject.userId = context.userId;
    }

    if (meta) {
      logObject.meta = meta;
    }

    return JSON.stringify(logObject);
  }

  info(message: string, meta?: LogMetadata): void {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: LogMetadata): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, error?: unknown, meta?: LogMetadata): void {
    const errorMeta: LogMetadata = error && error instanceof Error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          ...meta,
        }
      : meta || {};
    console.error(this.formatMessage('error', message, errorMeta));
  }

  debug(message: string, meta?: LogMetadata): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  static runWithContext<T>(context: LogContext, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  }

  static getContext(): LogContext {
    return asyncLocalStorage.getStore() || {};
  }

  static setContext(context: Partial<LogContext>): void {
    const currentContext = asyncLocalStorage.getStore() || {};
    Object.assign(currentContext, context);
  }
}

export const logger = new Logger();
export { Logger };
export type { LogContext };
