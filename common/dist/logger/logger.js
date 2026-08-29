"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogStream = exports.rawWinstonLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
class LoggerService {
    /**
     * Creates a logger instance.
     *
     * @param baseMeta Metadata automatically attached to every log entry.
     * @param logger Existing Winston logger used when creating child logger instances.
     */
    constructor(baseMeta = {}, logger) {
        this.baseMeta = baseMeta;
        /**
         * Colors used for console output.
         *
         * File logs are intentionally kept uncolored so they remain easy to
         * search, parse and process by external tools.
         */
        this.colors = {
            error: 'bold red',
            warn: 'bold yellow',
            info: 'bold green',
            http: 'magenta',
            debug: 'blue',
        };
        this.logger = logger ?? this.createLogger();
    }
    /**
     * Removes internal Winston properties from log metadata and formats
     * the remaining values as readable JSON.
     *
     * This keeps the actual application metadata separate from fields
     * already displayed in the main log line.
     */
    formatMeta(meta) {
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
    buildPlainFormat() {
        return winston_1.default.format.printf(({ timestamp, level, message, stack, ...meta }) => {
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
    createLogger() {
        winston_1.default.addColors(this.colors);
        const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }), winston_1.default.format.errors({
            stack: true,
        }), winston_1.default.format.colorize(), this.buildPlainFormat());
        const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }), winston_1.default.format.errors({
            stack: true,
        }), this.buildPlainFormat());
        const consoleTransport = new winston_1.default.transports.Console({
            format: consoleFormat,
        });
        const combinedFileTransport = new winston_daily_rotate_file_1.default({
            dirname: LoggerService.LOG_DIR,
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            format: fileFormat,
        });
        return winston_1.default.createLogger({
            levels: LoggerService.levels,
            level: LoggerService.LOG_LEVEL,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({
                stack: true,
            })),
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
    extractErrorFields(error) {
        const skip = new Set(['message', 'stack', 'name']);
        const extra = {};
        for (const key of Object.getOwnPropertyNames(error)) {
            if (!skip.has(key)) {
                extra[key] = error[key];
            }
        }
        return extra;
    }
    /**
     * Determines whether a value is an Error instance.
     */
    isErrorLike(value) {
        return value instanceof Error;
    }
    /**
     * Determines whether a value is a plain metadata object.
     *
     * Error instances and other object types are deliberately excluded
     * so they can be handled separately by the error normalization logic.
     */
    isPlainMeta(value) {
        return typeof value === 'object' && value !== null && !(value instanceof Error) && value.constructor === Object;
    }
    /**
     * Converts an unknown thrown value into a consistent log structure.
     *
     * JavaScript allows anything to be thrown, not just Error instances.
     * This method makes sure all such values can still be logged in a
     * predictable format.
     */
    normalizeUnknownError(value) {
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
    withBaseMeta(meta) {
        if (Object.keys(this.baseMeta).length === 0 && !meta) {
            return undefined;
        }
        return {
            ...this.baseMeta,
            ...(meta ?? {}),
        };
    }
    /**
     * Logs an error using the supported error overloads.
     *
     * When an Error is supplied, its message, stack, name and additional
     * properties are automatically extracted. Plain metadata is kept
     * separate from thrown errors.
     */
    error(messageOrError, metaOrError, maybeMeta) {
        if (typeof messageOrError === 'string') {
            if (metaOrError !== undefined && !this.isPlainMeta(metaOrError)) {
                const { meta: errMeta } = this.normalizeUnknownError(metaOrError);
                this.logger.error(messageOrError, this.withBaseMeta({
                    ...errMeta,
                    ...(maybeMeta ?? {}),
                }));
                return;
            }
            this.logger.error(messageOrError, this.withBaseMeta(metaOrError));
            return;
        }
        const { message, meta: errMeta } = this.normalizeUnknownError(messageOrError);
        const extraMeta = this.isPlainMeta(metaOrError) ? metaOrError : {};
        this.logger.error(message, this.withBaseMeta({
            ...errMeta,
            ...extraMeta,
        }));
    }
    /**
     * Logs a warning message.
     *
     * @param message Message to write to the log.
     * @param meta Optional metadata attached to the log entry.
     */
    warn(message, meta) {
        this.logger.warn(message, this.withBaseMeta(meta));
    }
    /**
     * Logs an informational message.
     *
     * @param message Message to write to the log.
     * @param meta Optional metadata attached to the log entry.
     */
    info(message, meta) {
        this.logger.info(message, this.withBaseMeta(meta));
    }
    /**
     * Logs an HTTP-related message.
     *
     * @param message HTTP log message.
     * @param meta Optional request or response metadata.
     */
    http(message, meta) {
        this.logger.http(message, this.withBaseMeta(meta));
    }
    /**
     * Logs a debug message.
     *
     * @param message Detailed debugging information.
     * @param meta Optional metadata attached to the log entry.
     */
    debug(message, meta) {
        this.logger.debug(message, this.withBaseMeta(meta));
    }
    /**
     * Returns the underlying Winston logger.
     *
     * This is useful when direct access to Winston functionality is
     * required that is not exposed by the Flutry Logger interface.
     */
    get raw() {
        return this.logger;
    }
    /**
     * Returns a writable stream compatible with HTTP logging middleware.
     *
     * Each written message is trimmed and forwarded to the `http` log level.
     */
    get httpLogStream() {
        return {
            write: (message) => this.http(message.trim()),
        };
    }
}
/**
 * Directory where rotated log files are stored.
 */
LoggerService.LOG_DIR = path_1.default.join(process.cwd(), 'logs');
/**
 * Active log level.
 *
 * `LOG_LEVEL` can be used to override the default. Production uses
 * `info`, while development environments use `debug`.
 */
LoggerService.LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
/**
 * Winston log level priorities used by Flutry.
 */
LoggerService.levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
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
exports.logger = loggerInstance;
/**
 * Exposes the underlying Winston logger for integrations that require
 * direct Winston access.
 */
exports.rawWinstonLogger = loggerInstance.raw;
/**
 * Writable stream for HTTP logging middleware.
 */
exports.httpLogStream = loggerInstance.httpLogStream;
