import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { FastifyInstance } from 'fastify';
import { Server, type ServerOptions } from 'socket.io';
import { logger } from '@flutry/common';
import type { HttpOptions } from '../types/server.typet';

/**
 * Stores the globally registered Socket instance.
 */
let socketInstance: Socket | null = null;

/**
 * Socket.IO wrapper used by the Flutry HTTP server.
 */
export class Socket {
  private readonly io: Server;
  private closePromise: Promise<void> | null = null;

  constructor(app: FastifyInstance, options?: Partial<ServerOptions>) {
    this.io = new Server(app.server, options);

    logger.info('Socket.IO server initialized');
  }

  /**
   * Returns the underlying Socket.IO server.
   */
  public get instance(): Server {
    return this.io;
  }

  /**
   * Returns the number of connected clients.
   */
  public get connected(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Emits an event to all connected clients.
   */
  public emit(event: string, data?: unknown): boolean {
    return this.io.emit(event, data);
  }

  /**
   * Registers a Socket.IO event listener.
   */
  public on(event: string, listener: (...args: any[]) => void): this {
    this.io.on(event, listener);

    return this;
  }

  /**
   * Closes Socket.IO and its active connections.
   *
   * Concurrent calls share the same shutdown promise.
   */
  public close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closePromise = new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });

    return this.closePromise;
  }

  /**
   * Indicates whether the underlying HTTP server is running.
   */
  public get isRunning(): boolean {
    return this.io.httpServer?.listening ?? false;
  }
}

/**
 * Recursively loads Socket.IO utility files.
 */
async function loadSocketFolder(directory: string): Promise<void> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await loadSocketFolder(filePath);
      continue;
    }

    if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js'))) {
      continue;
    }

    await import(pathToFileURL(filePath).href);

    logger.info(`Loaded Socket.IO file: ${path.relative(process.cwd(), filePath)}`);
  }
}

/**
 * Loads application Socket.IO utility files.
 *
 * The directory is optional.
 */
export async function loadSocketUtils(): Promise<void> {
  const socketDirectory = path.resolve(process.cwd(), 'src', 'utils', 'socket');

  try {
    await fs.access(socketDirectory);
  } catch {
    return;
  }

  await loadSocketFolder(socketDirectory);
}

/**
 * Registers Socket.IO with the Fastify HTTP server.
 */
export function registerSocket(app: FastifyInstance, options: HttpOptions): Socket | null {
  if (options.socket === false) {
    socketInstance = null;

    logger.info('Socket.IO is disabled');

    return null;
  }

  socketInstance = new Socket(app, options.socket);

  const socket = socketInstance;

  /**
   * Close Socket.IO before Fastify drains HTTP connections.
   */
  app.addHook('preClose', async () => {
    await socket.close();
  });

  /**
   * Release the global reference after Fastify closes.
   */
  app.addHook('onClose', async () => {
    if (socketInstance === socket) {
      socketInstance = null;
    }
  });

  return socket;
}

/**
 * Returns the globally registered Socket.IO instance.
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    const error = new Error('Socket.IO is not initialized. Enable Socket.IO in HttpServer options.');

    logger.error(error.message);

    throw error;
  }

  return socketInstance;
}

/**
 * Sends an event to all clients in a Socket.IO room.
 */
export function sendRoom(room: string, event: string, payload: any): void {
  getSocket().instance.to(room).emit(event, payload);
}
