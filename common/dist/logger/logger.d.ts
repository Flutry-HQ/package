import winston from 'winston';
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
export declare const logger: Logger;
export declare const rawWinstonLogger: winston.Logger;
export declare const httpLogStream: {
    write: (message: string) => void;
};
