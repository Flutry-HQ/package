import crypto from 'node:crypto';
import { networkInterfaces } from 'node:os';

import { logger } from '../logger/logger';

/**
 * Generates unique, sortable Snowflake-style IDs.
 *
 * ID structure:
 *
 * - Timestamp: milliseconds since January 1, 2023 (UTC)
 * - Machine ID: 22 bits
 * - Sequence: 6 bits
 *
 * IMPORTANT:
 * The timestamp field grows over time, so generated IDs are
 * not guaranteed to fit within a signed or unsigned 64-bit integer.
 *
 * IDs are returned as decimal strings to preserve precision.
 *
 * For database storage, use a sufficiently large string column
 * (for example VARCHAR(32)) rather than BIGINT.
 *
 * For guaranteed uniqueness across multiple service instances,
 * configure a distinct SNOWFLAKE_MACHINE_ID for each instance.
 *
 * Without explicit configuration, a random machine ID is generated.
 * Random IDs reduce collision probability but do not eliminate it.
 */
export class SnowflakeService {
  /**
   * Machine identifier assigned to this generator.
   */
  private machineId: number | undefined;

  /**
   * Last logical timestamp used to generate an ID.
   */
  private lastTimestamp = -1;

  /**
   * Sequence counter for IDs generated in the same millisecond.
   */
  private sequence = 0;

  /**
   * Custom epoch: January 1, 2023, 00:00:00 UTC.
   */
  private static readonly EPOCH = 1672531200000;

  /**
   * Machine identifier bit allocation.
   */
  private static readonly MACHINE_ID_BITS = 22;

  /**
   * Per-millisecond sequence bit allocation.
   */
  private static readonly SEQUENCE_BITS = 6;

  /**
   * Maximum machine identifier.
   */
  private static readonly MAX_MACHINE_ID = 2 ** SnowflakeService.MACHINE_ID_BITS - 1;

  /**
   * Maximum sequence number.
   */
  private static readonly MAX_SEQUENCE = 2 ** SnowflakeService.SEQUENCE_BITS - 1;

  /**
   * Initializes the machine identifier.
   *
   * Priority:
   * 1. Explicit SNOWFLAKE_MACHINE_ID environment variable
   * 2. Randomly generated identifier
   */
  private ensureMachineId(): void {
    if (this.machineId !== undefined) {
      return;
    }

    try {
      const configuredId = process.env.SNOWFLAKE_MACHINE_ID;

      if (configuredId !== undefined) {
        if (!/^\d+$/.test(configuredId)) {
          throw new RangeError('SNOWFLAKE_MACHINE_ID must be a non-negative integer');
        }

        const parsedId = Number(configuredId);

        if (!Number.isSafeInteger(parsedId) || parsedId < 0 || parsedId > SnowflakeService.MAX_MACHINE_ID) {
          throw new RangeError(`SNOWFLAKE_MACHINE_ID must be between 0 and ${SnowflakeService.MAX_MACHINE_ID}`);
        }

        this.machineId = parsedId;

        return;
      }

      const machineKey = crypto.randomBytes(32).toString('hex');
      const mac = this.getMacAddress();

      const hash = crypto.createHash('sha256').update(`${mac}:${machineKey}`).digest();

      this.machineId = hash.readUInt32BE(0) % (SnowflakeService.MAX_MACHINE_ID + 1);
    } catch (error) {
      logger.error('Failed to initialize Snowflake machine ID', error);

      throw error;
    }
  }

  /**
   * Retrieves the first available non-internal MAC address.
   *
   * Falls back to a zero MAC if no suitable interface exists.
   */
  private getMacAddress(): string {
    try {
      const interfaces = networkInterfaces();

      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];

        if (!iface) {
          continue;
        }

        for (const addr of iface) {
          if (!addr.internal && addr.mac !== '00:00:00:00:00:00') {
            return addr.mac;
          }
        }
      }

      return '00:00:00:00:00:00';
    } catch (error) {
      logger.warn('Failed to retrieve network interface information', error instanceof Error ? { error: error.message } : { error });

      return '00:00:00:00:00:00';
    }
  }

  /**
   * Returns milliseconds elapsed since the custom epoch.
   */
  private currentTimestamp(): number {
    return Date.now() - SnowflakeService.EPOCH;
  }

  /**
   * Generates a sortable Snowflake-style identifier.
   *
   * IDs are monotonically increasing within this generator.
   *
   * When the sequence reaches its limit, the logical timestamp
   * advances without blocking the event loop.
   *
   * If the system clock moves backwards, the previous logical
   * timestamp is retained.
   *
   * @returns A decimal string representing the generated ID.
   */
  public generate(): string {
    try {
      this.ensureMachineId();

      let timestamp = this.currentTimestamp();

      if (timestamp < this.lastTimestamp) {
        timestamp = this.lastTimestamp;
      }

      if (timestamp === this.lastTimestamp) {
        this.sequence++;

        if (this.sequence > SnowflakeService.MAX_SEQUENCE) {
          timestamp = this.lastTimestamp + 1;
          this.sequence = 0;
        }
      } else {
        this.sequence = 0;
      }

      this.lastTimestamp = timestamp;

      const id =
        (BigInt(timestamp) << BigInt(SnowflakeService.MACHINE_ID_BITS + SnowflakeService.SEQUENCE_BITS)) |
        (BigInt(this.machineId!) << BigInt(SnowflakeService.SEQUENCE_BITS)) |
        BigInt(this.sequence);

      return id.toString();
    } catch (error) {
      logger.error('Failed to generate Snowflake ID', error);

      throw error;
    }
  }
}

/**
 * Shared Snowflake generator for Flutry applications.
 */
export const snowflake = new SnowflakeService();
