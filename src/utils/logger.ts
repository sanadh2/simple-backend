import { AsyncLocalStorage } from 'async_hooks';
import chalk from 'chalk';
import { logQueue, type LogJob } from '../queues/logQueue.js';

interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}

interface LogMetadata {
  [key: string]: unknown;
}

const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private queueLog(
    level: LogLevel,
    message: string,
    meta?: LogMetadata
  ): void {
    try {
      const context = this.getContext();
      const logData: LogJob = {
        timestamp: new Date(),
        level,
        correlationId: context.correlationId || 'N/A',
        message,
      };

      if (context.userId) {
        logData.userId = context.userId;
      }

      if (meta) {
        logData.meta = meta;
      }

      void logQueue.add('log-entry', logData, {
        priority: level === 'error' ? 1 : level === 'warn' ? 2 : 3,
      }).catch((error) => {
        console.error('Failed to queue log:', error);
      });
    } catch (error) {
      console.error('Failed to queue log:', error);
    }
  }

  private getContext(): LogContext {
    return asyncLocalStorage.getStore() || {};
  }

  private formatConsoleMessage(level: LogLevel, message: string, meta?: LogMetadata): string {
    const context = this.getContext();
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    let levelColor: (text: string) => string;
    let levelBadge: string;

    switch (level) {
      case 'info':
        levelColor = chalk.blue.bold;
        levelBadge = 'INFO ';
        break;
      case 'warn':
        levelColor = chalk.yellow.bold;
        levelBadge = 'WARN ';
        break;
      case 'error':
        levelColor = chalk.red.bold;
        levelBadge = 'ERROR';
        break;
      case 'debug':
        levelColor = chalk.gray.bold;
        levelBadge = 'DEBUG';
        break;
    }

    const parts = [
      chalk.dim(`[${timestamp}]`),
      levelColor(levelBadge),
    ];

    if (context.correlationId) {
      parts.push(chalk.magenta(`[${context.correlationId.slice(0, 8)}]`));
    }

    if (context.userId) {
      parts.push(chalk.cyan(`[User: ${context.userId.slice(0, 8)}]`));
    }

    parts.push(message);

    let output = parts.join(' ');

    if (meta && Object.keys(meta).length > 0) {
      output += '\n' + chalk.dim(JSON.stringify(meta, null, 2));
    }

    return output;
  }

  info(message: string, meta?: LogMetadata, consoleOnly = false): void {
    console.log(this.formatConsoleMessage('info', message, meta));
    if (!consoleOnly) {
      this.queueLog('info', message, meta);
    }
  }

  warn(message: string, meta?: LogMetadata, consoleOnly = false): void {
    console.warn(this.formatConsoleMessage('warn', message, meta));
    if (!consoleOnly) {
      this.queueLog('warn', message, meta);
    }
  }

  error(message: string, error?: unknown, meta?: LogMetadata, consoleOnly = false): void {
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
    console.error(this.formatConsoleMessage('error', message, errorMeta));
    if (!consoleOnly) {
      this.queueLog('error', message, errorMeta);
    }
  }

  debug(message: string, meta?: LogMetadata, consoleOnly = false): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatConsoleMessage('debug', message, meta));
      if (!consoleOnly) {
        this.queueLog('debug', message, meta);
      }
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
