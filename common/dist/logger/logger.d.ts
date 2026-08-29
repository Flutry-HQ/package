import winston from 'winston';
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
/**
 * Public Flutry logger.
 *
 * Provides a small, stable logging API without exposing Winston
 * implementation details to packages that only need normal logging.
 */
export declare const logger: Logger;
/**
 * Exposes the underlying Winston logger for integrations that require
 * direct Winston access.
 */
export declare const rawWinstonLogger: winston.Logger;
/**
 * Writable stream for HTTP logging middleware.
 */
export declare const httpLogStream: {
    write: (message: string) => void;
};
