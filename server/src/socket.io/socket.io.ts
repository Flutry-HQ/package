import type { FastifyInstance } from 'fastify';
import { Server, type ServerOptions } from 'socket.io';
import { HttpOptions } from '../types/server.typet';

export class Socket {
  private readonly io: Server;

  constructor(app: FastifyInstance, options?: Partial<ServerOptions>) {
    this.io = new Server(app.server, options);
  }

  public get instance(): Server {
    return this.io;
  }

  public get connected(): number {
    return this.io.engine.clientsCount;
  }

  public emit(event: string, data?: unknown): boolean {
    return this.io.emit(event, data);
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.io.on(event, listener);

    return this;
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => resolve());
    });
  }

  public get isRunning(): boolean {
    return this.io.httpServer?.listening ?? false;
  }
}

export function registerSocket(app: FastifyInstance, options: HttpOptions): Socket | null {
  if (options.socket !== false) {
    return new Socket(app, options.socket);
  }
  return null;
}
