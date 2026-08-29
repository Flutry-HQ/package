import { Sequelize } from 'sequelize';
import { logger } from '@flutry/common';
import Models from '../models/models';

/**
 * Supported Sequelize database dialects.
 */
export type DatabaseDialect = 'mysql' | 'mariadb';

/**
 * Configuration options used to establish a database connection.
 */
export interface DatabaseOptions {
  /** Database name. */
  database: string;

  /** Database username. */
  username: string;

  /** Database password. */
  password: string;

  /** Database host. */
  host: string;

  /** Database port. */
  port: number;

  /** Database dialect. */
  dialect: DatabaseDialect;
}

/**
 * Manages the Sequelize database connection for Flutry applications.
 *
 * The connection manager handles:
 * - Database connection initialization
 * - Automatic connection retries
 * - Model initialization
 * - Database schema synchronization
 * - Connection status tracking
 * - Manual reconnection
 */
export class Connect {
  /** Active Sequelize instance. */
  public static sequelize: Sequelize;

  /** Indicates whether the database connection is currently active. */
  private static connected = false;

  /** Maximum number of connection attempts. */
  private static readonly MAX_RETRIES = 5;

  /** Delay between connection attempts in milliseconds. */
  private static readonly RETRY_DELAY = 5000;

  /**
   * Creates a new database connection manager.
   *
   * The connection process starts automatically after construction.
   *
   * @param options Database connection configuration.
   */
  public constructor(private readonly options: DatabaseOptions) {
    void this.connect();
  }

  /**
   * Returns whether the database is currently connected.
   */
  public static get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Reconnects to the database.
   *
   * The current connection is closed before a new connection is established.
   */
  public async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connectWithRetry();
  }

  /**
   * Starts the database connection process.
   */
  private async connect(): Promise<void> {
    await this.connectWithRetry();
  }

  /**
   * Closes the current database connection.
   */
  private async disconnect(): Promise<void> {
    try {
      await Connect.sequelize?.close();

      Connect.connected = false;
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }

  /**
   * Attempts to establish a database connection.
   *
   * Failed connections are retried until the maximum number of attempts
   * is reached. Once the connection is established, all application
   * models are initialized.
   *
   * @param attempt Current connection attempt number.
   */
  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.createConnection();

      await Connect.sequelize.authenticate();

      logger.info('Database connection established');

      // Load models and configure their associations.
      await new Models().init();

      Connect.connected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error(`Connection failed (${attempt}/${Connect.MAX_RETRIES}): ${message}`);

      if (attempt >= Connect.MAX_RETRIES) {
        logger.error('Max retries reached. Database connection failed.', error);

        process.exit(1);
      }

      logger.warn(`Retrying in ${Connect.RETRY_DELAY / 1000}s...`);

      await new Promise<void>((resolve) => setTimeout(resolve, Connect.RETRY_DELAY));

      return this.connectWithRetry(attempt + 1);
    }
  }

  /**
   * Returns the local system timezone in Sequelize-compatible format.
   */
  private getTimeZone = async (): Promise<string> => {
    const date = new Date();
    const offsetMinutes = date.getTimezoneOffset();

    const sign = offsetMinutes > 0 ? '-' : '+';

    const offsetHours = String(Math.abs(Math.floor(offsetMinutes / 60))).padStart(2, '0');

    const offsetMinutesFormatted = String(Math.abs(offsetMinutes % 60)).padStart(2, '0');

    return `${sign}${offsetHours}:${offsetMinutesFormatted}`;
  };

  /**
   * Creates and configures the Sequelize instance.
   */
  private async createConnection(): Promise<void> {
    const { database, username, password, host, port, dialect } = this.options;

    Connect.sequelize = new Sequelize(database, username, password, {
      host,
      port,
      dialect,
      logging: false,
      timezone: await this.getTimeZone(),

      // Prevent the connection from hanging indefinitely.
      dialectOptions: {
        connectTimeout: 15000,
      },

      // Configure the Sequelize connection pool.
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000,
      },

      // Retry common network-related connection errors.
      retry: {
        match: [/ETIMEDOUT/, /EHOSTUNREACH/, /ECONNRESET/, /ECONNREFUSED/],
        max: 3,
      },

      // Use UTF-8 for full Unicode support and binary-safe comparisons.
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_bin',
      },
    });
  }
}
