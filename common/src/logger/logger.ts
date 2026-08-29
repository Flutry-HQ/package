import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

export type LogMeta = Record<string, unknown>;

export type LoggableError = Error & Record<string, unknown>;

export type ErrorMeta = LogMeta;

/**
 * Public logging interface used by Flutry services and packages.
 *
 * The logger supports the standard Winston log levels used by Flutry:
 * `error`, `warn`, `info`, `http` and `debug`.
 */
export interface Logger {
  /**
   * Logs an error message.
   *
   * Supports multiple forms:
   * - `error('Something failed')`
   * - `error('Something failed', { userId: 123 })`
   * - `error(error)`
   * - `error(error, { userId: 123 })`
   * - `error('Something failed', error, { userId: 123 })`
   *
   * Error objects are automatically converted into useful log metadata,
   * including their name, message and stack trace.
   */
  error(message: string, meta?: LogMeta): void;

  /**
   * Logs an Error or unknown thrown value.
   *
   * Error details are extracted automatically and included in the log.
   */
  error(error: unknown, meta?: ErrorMeta): void;

  /**
   * Logs a custom error message together with an Error or thrown value.
   *
   * Additional metadata can be supplied as the third argument.
   */
  error(message: string, error: unknown, meta?: ErrorMeta): void;

  /**
   * Logs a warning.
   *
   * Use this for unexpected situations that do not prevent the
   * application from continuing to work.
   */
  warn(message: string, meta?: LogMeta): void;

  /**
   * Logs general application information.
   *
   * This is the default level for important runtime events that are
   * useful in production logs.
   */
  info(message: string, meta?: LogMeta): void;

  /**
   * Logs HTTP-related activity.
   *
   * This level is useful for request/response logging and can also be
   * used as a stream target for HTTP logging middleware.
   */
  http(message: string, meta?: LogMeta): void;

  /**
   * Logs detailed debugging information.
   *
   * Debug logs are enabled by default outside production and are
   * normally disabled in production unless `LOG_LEVEL` is configured.
   */
  debug(message: string, meta?: LogMeta): void;
}

class LoggerService implements Logger {
  /**
   * Directory where rotated log files are stored.
   */
  private static readonly LOG_DIR = path.join(process.cwd(), 'logs');

  /**
   * Active log level.
   *
   * `LOG_LEVEL` can be used to override the default. Production uses
   * `info`, while development environments use `debug`.
   */
  private static readonly LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  /**
   * Winston log level priorities used by Flutry.
   */
  private static readonly levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  };

  /**
   * Colors used for console output.
   *
   * File logs are intentionally kept uncolored so they remain easy to
   * search, parse and process by external tools.
   */
  private readonly colors = {
    error: 'bold red',
    warn: 'bold yellow',
    info: 'bold green',
    http: 'magenta',
    debug: 'blue',
  };

  private readonly logger: winston.Logger;

  /**
   * Creates a logger instance.
   *
   * @param baseMeta Metadata automatically attached to every log entry.
   * @param logger Existing Winston logger used when creating child logger instances.
   */
  constructor(
    private readonly baseMeta: LogMeta = {},
    logger?: winston.Logger,
  ) {
    this.logger = logger ?? this.createLogger();
  }

  /**
   * Removes internal Winston properties from log metadata and formats
   * the remaining values as readable JSON.
   *
   * This keeps the actual application metadata separate from fields
   * already displayed in the main log line.
   */
  private formatMeta(meta: Record<string, unknown>): string {
    const cleaned = { ...meta };

    delete cleaned.timestamp;
    delete cleaned.level;
    delete cleaned.message;
    delete cleaned.service;
    delete cleaned.stack;

    const keys = Object.keys(cleaned);

    if (keys.length === 0) {
      return '';
    }

    return '\n' + JSON.stringify(cleaned, null, 2);
  }

  /**
   * Creates the common human-readable log format.
   *
   * The resulting line starts with the timestamp, log level and message,
   * followed by the error stack and additional metadata when available.
   */
  private buildPlainFormat() {
    return winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const base = `[${timestamp}] [${level}] : ${message}`;

      const stackStr = stack ? `\n${stack}` : '';

      const metaStr = this.formatMeta(meta);

      return `${base}${stackStr}${metaStr}`;
    });
  }

  /**
   * Creates and configures the underlying Winston logger.
   *
   * Console output is colorized for easier development, while file
   * output remains plain text. Log files are rotated daily and removed
   * automatically after the configured retention period.
   */
  private createLogger(): winston.Logger {
    winston.addColors(this.colors);

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({
        stack: true,
      }),
      winston.format.colorize(),
      this.buildPlainFormat(),
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({
        stack: true,
      }),
      this.buildPlainFormat(),
    );

    const consoleTransport = new winston.transports.Console({
      format: consoleFormat,
    });

    const combinedFileTransport = new DailyRotateFile({
      dirname: LoggerService.LOG_DIR,
      filename: '%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    });

    return winston.createLogger({
      levels: LoggerService.levels,
      level: LoggerService.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({
          stack: true,
        }),
      ),
      transports: [consoleTransport, combinedFileTransport],
      exitOnError: false,
    });
  }

  /**
   * Extracts custom properties from an Error object.
   *
   * Standard Error properties are handled separately, while additional
   * properties added by libraries or application code are preserved as
   * metadata.
   */
  private extractErrorFields(error: LoggableError): LogMeta {
    const skip = new Set(['message', 'stack', 'name']);

    const extra: LogMeta = {};

    for (const key of Object.getOwnPropertyNames(error)) {
      if (!skip.has(key)) {
        extra[key] = (error as Record<string, unknown>)[key];
      }
    }

    return extra;
  }

  /**
   * Determines whether a value is an Error instance.
   */
  private isErrorLike(value: unknown): value is LoggableError {
    return value instanceof Error;
  }

  /**
   * Determines whether a value is a plain metadata object.
   *
   * Error instances and other object types are deliberately excluded
   * so they can be handled separately by the error normalization logic.
   */
  private isPlainMeta(value: unknown): value is LogMeta {
    return typeof value === 'object' && value !== null && !(value instanceof Error) && value.constructor === Object;
  }

  /**
   * Converts an unknown thrown value into a consistent log structure.
   *
   * JavaScript allows anything to be thrown, not just Error instances.
   * This method makes sure all such values can still be logged in a
   * predictable format.
   */
  private normalizeUnknownError(value: unknown): {
    message: string;
    meta: LogMeta;
  } {
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
   * Merges instance-level metadata with metadata supplied for a
   * particular log entry.
   *
   * Per-entry metadata takes precedence when the same key exists in
   * both objects.
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

  error(messageOrError: string, meta?: LogMeta): void;

  error(error: unknown, meta?: ErrorMeta): void;

  error(message: string, error: unknown, meta?: ErrorMeta): void;

  /**
   * Logs an error using the supported error overloads.
   *
   * When an Error is supplied, its message, stack, name and additional
   * properties are automatically extracted. Plain metadata is kept
   * separate from thrown errors.
   */
  error(messageOrError: string | unknown, metaOrError?: LogMeta | unknown, maybeMeta?: ErrorMeta): void {
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

  /**
   * Logs a warning message.
   *
   * @param message Message to write to the log.
   * @param meta Optional metadata attached to the log entry.
   */
  warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, this.withBaseMeta(meta));
  }

  /**
   * Logs an informational message.
   *
   * @param message Message to write to the log.
   * @param meta Optional metadata attached to the log entry.
   */
  info(message: string, meta?: LogMeta): void {
    this.logger.info(message, this.withBaseMeta(meta));
  }

  /**
   * Logs an HTTP-related message.
   *
   * @param message HTTP log message.
   * @param meta Optional request or response metadata.
   */
  http(message: string, meta?: LogMeta): void {
    this.logger.http(message, this.withBaseMeta(meta));
  }

  /**
   * Logs a debug message.
   *
   * @param message Detailed debugging information.
   * @param meta Optional metadata attached to the log entry.
   */
  debug(message: string, meta?: LogMeta): void {
    this.logger.debug(message, this.withBaseMeta(meta));
  }

  /**
   * Returns the underlying Winston logger.
   *
   * This is useful when direct access to Winston functionality is
   * required that is not exposed by the Flutry Logger interface.
   */
  get raw(): winston.Logger {
    return this.logger;
  }

  /**
   * Returns a writable stream compatible with HTTP logging middleware.
   *
   * Each written message is trimmed and forwarded to the `http` log level.
   */
  get httpLogStream() {
    return {
      write: (message: string) => this.http(message.trim()),
    };
  }
}

/**
 * Shared LoggerService instance used throughout the application.
 *
 * Most Flutry packages should use this instance instead of creating
 * their own logger.
 */
const loggerInstance = new LoggerService();

/**
 * Public Flutry logger.
 *
 * Provides a small, stable logging API without exposing Winston
 * implementation details to packages that only need normal logging.
 */
export const logger: Logger = loggerInstance;

/**
 * Exposes the underlying Winston logger for integrations that require
 * direct Winston access.
 */
export const rawWinstonLogger = loggerInstance.raw;

/**
 * Writable stream for HTTP logging middleware.
 */
export const httpLogStream = loggerInstance.httpLogStream;
