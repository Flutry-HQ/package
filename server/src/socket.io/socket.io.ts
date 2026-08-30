import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { FastifyInstance } from 'fastify';
import { Server, type ServerOptions } from 'socket.io';
import { logger } from '@flutry/common';
import { HttpOptions } from '../types/server.typet';

/**
 * Stores the globally registered Socket instance.
 *
 * The Socket.IO server is initialized by HttpServer only once.
 * Other parts of the application can access the already initialized
 * instance through getSocket() without creating another Socket.IO server.
 */
let socketInstance: Socket | null = null;

/**
 * Socket.IO wrapper used by the Flutry HTTP server.
 *
 * This class is responsible for:
 * - Initializing the Socket.IO server.
 * - Exposing the underlying Socket.IO instance.
 * - Providing common Socket.IO utilities.
 * - Managing the Socket.IO server lifecycle.
 */
export class Socket {
  /**
   * Underlying Socket.IO server instance.
   */
  private readonly io: Server;

  /**
   * Creates a new Socket.IO server instance.
   *
   * @param app Fastify application instance.
   * @param options Optional Socket.IO server options.
   */
  constructor(app: FastifyInstance, options?: Partial<ServerOptions>) {
    this.io = new Server(app.server, options);

    logger.info('Socket.IO server initialized');
  }

  /**
   * Returns the underlying Socket.IO Server instance.
   *
   * This can be used when direct access to Socket.IO functionality
   * is required.
   */
  public get instance(): Server {
    return this.io;
  }

  /**
   * Returns the number of currently connected clients.
   */
  public get connected(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Emits an event to all currently connected clients.
   *
   * @param event Event name.
   * @param data Optional event payload.
   * @returns True when the event was successfully emitted.
   */
  public emit(event: string, data?: unknown): boolean {
    return this.io.emit(event, data);
  }

  /**
   * Registers an event listener on the Socket.IO server.
   *
   * @param event Event name.
   * @param listener Event listener callback.
   * @returns The current Socket instance for chaining.
   */
  public on(event: string, listener: (...args: any[]) => void): this {
    this.io.on(event, listener);

    return this;
  }

  /**
   * Closes the Socket.IO server.
   *
   * The returned promise resolves after the server has
   * completely finished shutting down.
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });
  }

  /**
   * Indicates whether the underlying HTTP server is currently running.
   */
  public get isRunning(): boolean {
    return this.io.httpServer?.listening ?? false;
  }
}

/**
 * Loads every TypeScript and JavaScript file from
 * src/utils/socket and all of its subdirectories.
 *
 * Files are imported after the Socket.IO instance has been
 * initialized, allowing them to use getSocket() safely.
 */
async function loadSocketFolder(directory: string): Promise<void> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);

    /**
     * Recursively load nested socket directories.
     */
    if (entry.isDirectory()) {
      await loadSocketFolder(filePath);
      continue;
    }

    /**
     * Only load TypeScript and JavaScript files.
     */
    if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js'))) {
      continue;
    }

    /**
     * Import the socket file.
     *
     * Importing the module automatically executes its code,
     * allowing it to register Socket.IO events.
     */
    await import(pathToFileURL(filePath).href);

    logger.info(`Loaded Socket.IO file: ${path.relative(process.cwd(), filePath)}`);
  }
}

/**
 * Loads the application's Socket.IO utility files.
 *
 * The src/utils/socket directory is optional.
 * If the directory does not exist, Socket.IO continues normally.
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
 * Registers and initializes Socket.IO for the HTTP server.
 *
 * Socket.IO initialization itself is synchronous.
 * Socket utility files are loaded separately through
 * loadSocketUtils() before the HTTP server starts.
 *
 * @param app Fastify application instance.
 * @param options Flutry HTTP server options.
 * @returns The initialized Socket instance or null when disabled.
 */
export function registerSocket(app: FastifyInstance, options: HttpOptions): Socket | null {
  /**
   * Socket.IO is explicitly disabled.
   */
  if (options.socket === false) {
    socketInstance = null;

    logger.info('Socket.IO is disabled');

    return null;
  }

  /**
   * Initialize Socket.IO and store the instance globally.
   */
  socketInstance = new Socket(app, options.socket);

  return socketInstance;
}

/**
 * Returns the globally registered Socket instance.
 *
 * This function does not initialize Socket.IO.
 * Socket.IO must have been enabled and initialized by HttpServer first.
 *
 * @throws Error when Socket.IO has not been initialized.
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
 * Sends an event to all clients connected to a specific Socket.IO room.
 *
 * @param room Socket.IO room name.
 * @param event Event name.
 * @param payload Data sent with the event.
 */
export function sendRoom(room: string, event: string, payload: any): void {
  getSocket().instance.to(room).emit(event, payload);
}
