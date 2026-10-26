import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import { inspect } from 'node:util';

export type LogMeta = Record<string, unknown>;
export type LoggableError = Error & Record<string, unknown>;
export type ErrorMeta = LogMeta;

export interface Logger {
  error(message: string, meta?: LogMeta): void;
  error(error: unknown, meta?: ErrorMeta): void;
  error(message: string, error: unknown, meta?: ErrorMeta): void;
  warn(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  http(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
}

class LoggerService implements Logger {
  private static readonly LOG_DIR = path.join(process.cwd(), 'logs');

  private static readonly LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  private static readonly levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  };

  private readonly colors = {
    error: 'bold red',
    warn: 'bold yellow',
    info: 'bold green',
    http: 'magenta',
    debug: 'blue',
  };

  private readonly logger: winston.Logger;

  constructor(
    private readonly baseMeta: LogMeta = {},
    logger?: winston.Logger,
  ) {
    this.logger = logger ?? this.createLogger();
  }

  /**
   * Converts arbitrary values into JSON-safe representations.
   *
   * Handles:
   * - BigInt
   * - Circular references
   * - Error instances
   * - Functions and symbols
   * - Non-serializable objects
   */
  private safeStringify(value: unknown): string {
    try {
      const ancestors: object[] = [];

      const result = JSON.stringify(
        value,
        function (_key, current: unknown): unknown {
          if (typeof current === 'bigint') {
            return current.toString();
          }

          if (typeof current === 'function') {
            return `[Function: ${current.name || 'anonymous'}]`;
          }

          if (typeof current === 'symbol') {
            return current.toString();
          }

          if (current instanceof Error) {
            const errorFields: Record<string, unknown> = {
              name: current.name,
              message: current.message,
              stack: current.stack,
            };

            for (const property of Object.getOwnPropertyNames(current)) {
              if (!(property in errorFields)) {
                try {
                  errorFields[property] = (current as unknown as Record<string, unknown>)[property];
                } catch {
                  errorFields[property] = '[Unreadable]';
                }
              }
            }

            current = errorFields;
          }

          if (typeof current === 'object' && current !== null) {
            while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
              ancestors.pop();
            }

            if (ancestors.includes(current)) {
              return '[Circular]';
            }

            ancestors.push(current);
          }

          return current;
        },
        2,
      );

      return result ?? String(value);
    } catch {
      try {
        return inspect(value, {
          depth: 5,
          colors: false,
          maxArrayLength: 100,
          maxStringLength: 10000,
          breakLength: 120,
          getters: false,
        });
      } catch {
        return '[Unserializable]';
      }
    }
  }

  /**
   * Safely formats additional metadata.
   */
  private formatMeta(meta: Record<string, unknown>): string {
    const cleaned = { ...meta };

    delete cleaned.timestamp;
    delete cleaned.level;
    delete cleaned.message;
    delete cleaned.service;
    delete cleaned.stack;

    if (Object.keys(cleaned).length === 0) {
      return '';
    }

    return `\n${this.safeStringify(cleaned)}`;
  }

  /**
   * Creates the shared human-readable log format.
   */
  private buildPlainFormat() {
    return winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const messageText = typeof message === 'string' ? message : this.safeStringify(message);

      const base = `[${timestamp}] [${level}] : ${messageText}`;

      const stackStr = stack ? `\n${String(stack)}` : '';
      const metaStr = this.formatMeta(meta);

      return `${base}${stackStr}${metaStr}`;
    });
  }

  /**
   * Reports logging infrastructure errors without
   * sending them through Winston again.
   */
  private reportTransportError(source: string, error: unknown): void {
    try {
      const message = error instanceof Error ? (error.stack ?? error.message) : inspect(error, { depth: 2, getters: false });

      process.stderr.write(`[Flutry Logger] ${source}: ${message}\n`);
    } catch {
      // Avoid throwing from the logging error handler.
    }
  }

  /**
   * Creates the Winston logger and attaches error handlers.
   */
  private createLogger(): winston.Logger {
    winston.addColors(this.colors);

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      this.buildPlainFormat(),
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({ stack: true }),
      this.buildPlainFormat(),
    );

    const consoleTransport = new winston.transports.Console({
      format: consoleFormat,
    });

    const fileTransport = new DailyRotateFile({
      dirname: LoggerService.LOG_DIR,
      filename: '%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    });

    const logger = winston.createLogger({
      levels: LoggerService.levels,
      level: LoggerService.LOG_LEVEL,
      format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true })),
      transports: [consoleTransport, fileTransport],
      exitOnError: false,
    });

    let fileTransportFailed = false;

    fileTransport.on('error', (error: Error) => {
      this.reportTransportError('File transport error', error);

      if (fileTransportFailed) {
        return;
      }

      fileTransportFailed = true;

      try {
        logger.remove(fileTransport);
      } catch (removeError) {
        this.reportTransportError('Failed to remove file transport', removeError);
      }
    });

    consoleTransport.on('error', (error: Error) => {
      this.reportTransportError('Console transport error', error);
    });

    logger.on('error', (error: Error) => {
      this.reportTransportError('Winston error', error);
    });

    return logger;
  }

  /**
   * Extracts custom Error properties.
   */
  private extractErrorFields(error: LoggableError): LogMeta {
    const skip = new Set(['message', 'stack', 'name']);
    const extra: LogMeta = {};

    for (const key of Object.getOwnPropertyNames(error)) {
      if (skip.has(key)) {
        continue;
      }

      try {
        extra[key] = (error as Record<string, unknown>)[key];
      } catch {
        extra[key] = '[Unreadable]';
      }
    }

    return extra;
  }

  private isErrorLike(value: unknown): value is LoggableError {
    return value instanceof Error;
  }

  private isPlainMeta(value: unknown): value is LogMeta {
    if (typeof value !== 'object' || value === null || value instanceof Error) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  /**
   * Normalizes thrown values.
   */
  private normalizeUnknownError(value: unknown): { message: string; meta: LogMeta } {
    if (this.isErrorLike(value)) {
      return {
        message: value.message,
        meta: {
          errorName: value.name,
          stack: value.stack,
          ...this.extractErrorFields(value),
        },
      };
    }

    if (typeof value === 'string') {
      return {
        message: value,
        meta: {},
      };
    }

    return {
      message: 'Ismeretlen hiba történt',
      meta: {
        thrownValue: value,
      },
    };
  }

  /**
   * Merges logger-level and entry-level metadata.
   */
  private withBaseMeta(meta?: LogMeta): LogMeta | undefined {
    if (Object.keys(this.baseMeta).length === 0 && !meta) {
      return undefined;
    }

    return {
      ...this.baseMeta,
      ...(meta ?? {}),
    };
  }

  error(message: string, meta?: LogMeta): void;
  error(error: unknown, meta?: ErrorMeta): void;
  error(message: string, error: unknown, meta?: ErrorMeta): void;

  error(messageOrError: unknown, metaOrError?: unknown, maybeMeta?: ErrorMeta): void {
    if (typeof messageOrError === 'string') {
      if (metaOrError !== undefined && !this.isPlainMeta(metaOrError)) {
        const { meta: errMeta } = this.normalizeUnknownError(metaOrError);

        this.logger.error(
          messageOrError,
          this.withBaseMeta({
            ...errMeta,
            ...(maybeMeta ?? {}),
          }),
        );

        return;
      }

      this.logger.error(messageOrError, this.withBaseMeta(metaOrError as LogMeta | undefined));

      return;
    }

    const { message, meta: errMeta } = this.normalizeUnknownError(messageOrError);

    const extraMeta = this.isPlainMeta(metaOrError) ? metaOrError : {};

    this.logger.error(
      message,
      this.withBaseMeta({
        ...errMeta,
        ...extraMeta,
      }),
    );
  }

  warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, this.withBaseMeta(meta));
  }

  info(message: string, meta?: LogMeta): void {
    this.logger.info(message, this.withBaseMeta(meta));
  }

  http(message: string, meta?: LogMeta): void {
    this.logger.http(message, this.withBaseMeta(meta));
  }

  debug(message: string, meta?: LogMeta): void {
    this.logger.debug(message, this.withBaseMeta(meta));
  }

  get raw(): winston.Logger {
    return this.logger;
  }

  get httpLogStream() {
    return {
      write: (message: string) => this.http(message.trim()),
    };
  }
}

const loggerInstance = new LoggerService();

export const logger: Logger = loggerInstance;

export const rawWinstonLogger = loggerInstance.raw;

export const httpLogStream = loggerInstance.httpLogStream;
