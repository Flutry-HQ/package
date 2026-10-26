import { Sequelize } from 'sequelize';
import { logger } from '@flutry/common';
import Models from '../models/models';

export type DatabaseDialect = 'mysql' | 'mariadb';

export interface DatabaseOptions {
  database: string;
  username: string;
  password: string;
  host: string;
  port: number;
  dialect: DatabaseDialect;
}

/**
 * Manages a single Sequelize connection for a Flutry application.
 */
export class Connect {
  public static sequelize: Sequelize;

  private static connected = false;
  private static owner: Connect | null = null;

  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_DELAY = 5000;

  private connection: Sequelize | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private disconnectPromise: Promise<void> | null = null;

  public readonly ready: Promise<void>;

  constructor(private readonly options: DatabaseOptions) {
    if (Connect.owner) {
      throw new Error('A database connection manager is already initialized. ' + 'Flutry currently supports one database manager per process.');
    }

    Connect.owner = this;
    this.ready = this.connectWithRetry();
  }

  public static get isConnected(): boolean {
    return Connect.connected;
  }

  /**
   * Reconnects to the database.
   *
   * Concurrent reconnect calls share one operation.
   */
  public reconnect(): Promise<void> {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    const operation = (async () => {
      await this.ready;

      await this.disconnectConnection();
      await this.connectWithRetry();
    })();

    this.reconnectPromise = operation;

    void operation
      .finally(() => {
        if (this.reconnectPromise === operation) {
          this.reconnectPromise = null;
        }
      })
      .catch(() => {});

    return operation;
  }

  /**
   * Closes the active connection and releases ownership.
   */
  public async close(): Promise<void> {
    await this.ready.catch(() => {});

    if (this.reconnectPromise) {
      await this.reconnectPromise.catch(() => {});
    }

    await this.disconnectConnection();

    if (Connect.owner === this) {
      Connect.owner = null;
    }
  }

  /**
   * Disconnects the currently owned Sequelize instance.
   */
  private disconnectConnection(): Promise<void> {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    const operation = (async () => {
      const connection = this.connection;

      this.connection = null;
      Connect.connected = false;

      if (connection) {
        try {
          await connection.close();

          logger.info('Database connection closed');
        } catch (error) {
          logger.error('Error closing database connection:', error);
          throw error;
        }
      }

      if (Connect.owner === this) {
        Connect.sequelize = undefined as unknown as Sequelize;
      }
    })();

    this.disconnectPromise = operation;

    void operation
      .finally(() => {
        if (this.disconnectPromise === operation) {
          this.disconnectPromise = null;
        }
      })
      .catch(() => {});

    return operation;
  }

  /**
   * Connects to the database with retry handling.
   */
  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= Connect.MAX_RETRIES; attempt++) {
      const connection = this.createConnection();

      this.connection = connection;

      try {
        await connection.authenticate();

        /**
         * Publish the connection only after authentication.
         */
        Connect.sequelize = connection;

        /**
         * Pass the authenticated Sequelize instance
         * to the model initializer.
         */
        await new Models({
          sequelize: connection,
        }).init();

        Connect.connected = true;

        logger.info('Database connection established');

        return;
      } catch (error) {
        Connect.connected = false;

        if (this.connection === connection) {
          this.connection = null;
        }

        if (Connect.sequelize === connection) {
          Connect.sequelize = undefined as unknown as Sequelize;
        }

        try {
          await connection.close();
        } catch (closeError) {
          logger.error('Failed to close database connection:', closeError);
        }

        const message = error instanceof Error ? error.message : String(error);

        logger.error(`Connection failed (${attempt}/${Connect.MAX_RETRIES}): ${message}`);

        if (attempt >= Connect.MAX_RETRIES) {
          logger.error('Max retries reached. Database connection failed.', error);

          throw error;
        }

        logger.warn(`Retrying in ${Connect.RETRY_DELAY / 1000}s...`);

        await new Promise<void>((resolve) => setTimeout(resolve, Connect.RETRY_DELAY));
      }
    }
  }

  /**
   * Returns the local timezone in Sequelize-compatible format.
   */
  private getTimeZone(): string {
    const offsetMinutes = new Date().getTimezoneOffset();

    const sign = offsetMinutes > 0 ? '-' : '+';
    const absoluteOffset = Math.abs(offsetMinutes);

    const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
    const minutes = String(absoluteOffset % 60).padStart(2, '0');

    return `${sign}${hours}:${minutes}`;
  }

  /**
   * Creates an independently owned Sequelize instance.
   */
  private createConnection(): Sequelize {
    const { database, username, password, host, port, dialect } = this.options;

    return new Sequelize(database, username, password, {
      host,
      port,
      dialect,
      logging: false,
      timezone: this.getTimeZone(),

      dialectOptions: {
        connectTimeout: 15000,
      },

      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000,
      },

      retry: {
        match: [/ETIMEDOUT/, /EHOSTUNREACH/, /ECONNRESET/, /ECONNREFUSED/],
        max: 3,
      },

      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_bin',
      },
    });
  }
}
