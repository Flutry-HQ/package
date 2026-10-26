"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogStream = exports.rawWinstonLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
class LoggerService {
    constructor(baseMeta = {}, logger) {
        this.baseMeta = baseMeta;
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
     * Converts arbitrary values into JSON-safe representations.
     *
     * Handles:
     * - BigInt
     * - Circular references
     * - Error instances
     * - Functions and symbols
     * - Non-serializable objects
     */
    safeStringify(value) {
        try {
            const ancestors = [];
            const result = JSON.stringify(value, function (_key, current) {
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
                    const errorFields = {
                        name: current.name,
                        message: current.message,
                        stack: current.stack,
                    };
                    for (const property of Object.getOwnPropertyNames(current)) {
                        if (!(property in errorFields)) {
                            try {
                                errorFields[property] = current[property];
                            }
                            catch {
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
            }, 2);
            return result ?? String(value);
        }
        catch {
            try {
                return (0, node_util_1.inspect)(value, {
                    depth: 5,
                    colors: false,
                    maxArrayLength: 100,
                    maxStringLength: 10000,
                    breakLength: 120,
                    getters: false,
                });
            }
            catch {
                return '[Unserializable]';
            }
        }
    }
    /**
     * Safely formats additional metadata.
     */
    formatMeta(meta) {
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
    buildPlainFormat() {
        return winston_1.default.format.printf(({ timestamp, level, message, stack, ...meta }) => {
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
    reportTransportError(source, error) {
        try {
            const message = error instanceof Error ? (error.stack ?? error.message) : (0, node_util_1.inspect)(error, { depth: 2, getters: false });
            process.stderr.write(`[Flutry Logger] ${source}: ${message}\n`);
        }
        catch {
            // Avoid throwing from the logging error handler.
        }
    }
    /**
     * Creates the Winston logger and attaches error handlers.
     */
    createLogger() {
        winston_1.default.addColors(this.colors);
        const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize(), this.buildPlainFormat());
        const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }), winston_1.default.format.errors({ stack: true }), this.buildPlainFormat());
        const consoleTransport = new winston_1.default.transports.Console({
            format: consoleFormat,
        });
        const fileTransport = new winston_daily_rotate_file_1.default({
            dirname: LoggerService.LOG_DIR,
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            format: fileFormat,
        });
        const logger = winston_1.default.createLogger({
            levels: LoggerService.levels,
            level: LoggerService.LOG_LEVEL,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true })),
            transports: [consoleTransport, fileTransport],
            exitOnError: false,
        });
        let fileTransportFailed = false;
        fileTransport.on('error', (error) => {
            this.reportTransportError('File transport error', error);
            if (fileTransportFailed) {
                return;
            }
            fileTransportFailed = true;
            try {
                logger.remove(fileTransport);
            }
            catch (removeError) {
                this.reportTransportError('Failed to remove file transport', removeError);
            }
        });
        consoleTransport.on('error', (error) => {
            this.reportTransportError('Console transport error', error);
        });
        logger.on('error', (error) => {
            this.reportTransportError('Winston error', error);
        });
        return logger;
    }
    /**
     * Extracts custom Error properties.
     */
    extractErrorFields(error) {
        const skip = new Set(['message', 'stack', 'name']);
        const extra = {};
        for (const key of Object.getOwnPropertyNames(error)) {
            if (skip.has(key)) {
                continue;
            }
            try {
                extra[key] = error[key];
            }
            catch {
                extra[key] = '[Unreadable]';
            }
        }
        return extra;
    }
    isErrorLike(value) {
        return value instanceof Error;
    }
    isPlainMeta(value) {
        if (typeof value !== 'object' || value === null || value instanceof Error) {
            return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }
    /**
     * Normalizes thrown values.
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
     * Merges logger-level and entry-level metadata.
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
    warn(message, meta) {
        this.logger.warn(message, this.withBaseMeta(meta));
    }
    info(message, meta) {
        this.logger.info(message, this.withBaseMeta(meta));
    }
    http(message, meta) {
        this.logger.http(message, this.withBaseMeta(meta));
    }
    debug(message, meta) {
        this.logger.debug(message, this.withBaseMeta(meta));
    }
    get raw() {
        return this.logger;
    }
    get httpLogStream() {
        return {
            write: (message) => this.http(message.trim()),
        };
    }
}
LoggerService.LOG_DIR = node_path_1.default.join(process.cwd(), 'logs');
LoggerService.LOG_LEVEL = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
LoggerService.levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const loggerInstance = new LoggerService();
exports.logger = loggerInstance;
exports.rawWinstonLogger = loggerInstance.raw;
exports.httpLogStream = loggerInstance.httpLogStream;
