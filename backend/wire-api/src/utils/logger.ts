/**
 * Enterprise Logger
 * 
 * Structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON output
 * - Request correlation IDs
 * - Performance metrics
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
    };

    if (this.isDevelopment) {
      // Pretty print in development
      console[level === 'error' ? 'error' : 'log'](
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        context || ''
      );
    } else {
      // JSON output in production
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
