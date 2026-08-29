import { type FastifyInstance } from 'fastify';
import { HttpOptions } from '../types/types';
export declare class HttpServer {
    private readonly startTime;
    private readonly routeLoader;
    readonly app: FastifyInstance;
    constructor(options?: HttpOptions);
    listen(port: number, host?: string): Promise<string>;
    close(): Promise<void>;
}
