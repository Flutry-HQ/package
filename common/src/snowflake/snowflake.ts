import crypto from 'crypto';
import { networkInterfaces } from 'os';

import { logger } from '../logger/logger';

/**
 * Generates unique, sortable Snowflake IDs.
 *
 * Each generated ID contains three parts:
 *
 * - timestamp: milliseconds elapsed since the configured epoch
 * - machine ID: identifies the running service instance
 * - sequence: distinguishes IDs generated during the same millisecond
 *
 * IDs are returned as strings because the resulting 64-bit value can be
 * larger than JavaScript's safe integer range.
 *
 * A new random machine key is generated for every service instance.
 * This makes separate instances on the same machine use different
 * machine IDs and greatly reduces the chance of collisions.
 */
export class SnowflakeService {
  /**
   * Machine identifier assigned to this service instance.
   *
   * It is generated lazily when the first ID is requested and remains
   * unchanged for the lifetime of this service instance.
   */
  private machineId: number | undefined;

  /**
   * Timestamp of the last generated ID.
   *
   * Used to guarantee that IDs are generated in chronological order
   * and to detect the system clock moving backwards.
   */
  private lastTimestamp = -1;

  /**
   * Sequence number used when multiple IDs are generated within the
   * same millisecond.
   */
  private sequence = 0;

  /**
   * Custom epoch used as the starting point for Snowflake timestamps.
   *
   * Using a custom epoch keeps the timestamp portion smaller than a
   * Unix timestamp while still providing a large usable time range.
   */
  private static readonly EPOCH = 1672531200000;

  /**
   * Number of bits reserved for the machine identifier.
   *
   * 22 bits allow up to 4,194,304 different machine IDs.
   */
  private static readonly MACHINE_ID_BITS = 22;

  /**
   * Number of bits reserved for the per-millisecond sequence.
   *
   * 6 bits allow up to 64 IDs to be generated within the same
   * millisecond by one service instance.
   */
  private static readonly SEQUENCE_BITS = 6;

  /**
   * Maximum value that can be stored in the machine ID section.
   */
  private static readonly MAX_MACHINE_ID = 2 ** SnowflakeService.MACHINE_ID_BITS - 1;

  /**
   * Maximum value that can be stored in the sequence section.
   */
  private static readonly MAX_SEQUENCE = 2 ** SnowflakeService.SEQUENCE_BITS - 1;

  /**
   * Generates the machine ID for the current service instance.
   *
   * The machine ID is derived from both the machine's MAC address and
   * a cryptographically secure random value generated when the service
   * starts. The random component ensures that multiple instances running
   * on the same machine are unlikely to receive the same machine ID.
   *
   * @throws If the machine ID cannot be initialized.
   */
  private ensureMachineId(): void {
    if (this.machineId !== undefined) {
      return;
    }

    try {
      const machineKey = crypto.randomBytes(32).toString('hex');

      const mac = this.getMacAddress();

      const hash = crypto.createHash('sha256').update(`${mac}:${machineKey}`).digest();

      this.machineId = hash.readUInt32BE(0) % (SnowflakeService.MAX_MACHINE_ID + 1);
    } catch (error) {
      logger.error('Failed to initialize Snowflake machine ID', error);

      throw new Error('Failed to initialize Snowflake machine ID');
    }
  }

  /**
   * Retrieves the first available non-internal MAC address.
   *
   * The MAC address is used as one of the inputs when generating the
   * instance-specific machine ID.
   *
   * If no usable interface is available, a zero MAC address is used.
   *
   * @returns A MAC address or the fallback zero address.
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
   * Returns the number of milliseconds elapsed since the custom epoch.
   *
   * @returns Milliseconds since `SnowflakeService.EPOCH`.
   */
  private currentTimestamp(): number {
    return Date.now() - SnowflakeService.EPOCH;
  }

  /**
   * Waits until the system clock reaches the next millisecond.
   *
   * This is used when the sequence counter is exhausted and another
   * ID cannot safely be generated within the current millisecond.
   *
   * @param lastTimestamp Timestamp that must be passed before continuing.
   * @returns The next available timestamp.
   */
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = this.currentTimestamp();

    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }

    return timestamp;
  }

  /**
   * Generates a new unique Snowflake ID.
   *
   * The generated ID is composed of:
   *
   * `timestamp | machine ID | sequence`
   *
   * When multiple IDs are generated during the same millisecond, the
   * sequence number is incremented. Once the sequence is exhausted,
   * generation waits for the next millisecond.
   *
   * The method also detects the system clock moving backwards and
   * refuses to generate an ID in that situation.
   *
   * @returns A unique Snowflake ID represented as a string.
   * @throws If the system clock moves backwards or ID generation fails.
   */
  generate(): string {
    try {
      this.ensureMachineId();

      let timestamp = this.currentTimestamp();

      if (timestamp < this.lastTimestamp) {
        const error = new Error('Clock moved backwards. Refusing to generate ID');

        logger.error('Snowflake clock moved backwards', error);

        throw error;
      }

      if (timestamp === this.lastTimestamp) {
        this.sequence++;

        if (this.sequence > SnowflakeService.MAX_SEQUENCE) {
          timestamp = this.waitNextMillis(this.lastTimestamp);

          this.sequence = 0;
        }
      } else {
        this.sequence = 0;
      }

      this.lastTimestamp = timestamp;

      /**
       * Builds the final Snowflake ID using bit shifting:
       *
       * timestamp  -> highest bits
       * machine ID -> middle bits
       * sequence   -> lowest bits
       */
      const id =
        (BigInt(timestamp) << BigInt(SnowflakeService.MACHINE_ID_BITS + SnowflakeService.SEQUENCE_BITS)) |
        (BigInt(this.machineId!) << BigInt(SnowflakeService.SEQUENCE_BITS)) |
        BigInt(this.sequence);

      return id.toString();
    } catch (error) {
      if (error instanceof Error && error.message === 'Clock moved backwards. Refusing to generate ID') {
        throw error;
      }

      logger.error('Failed to generate Snowflake ID', error);

      throw new Error('Failed to generate Snowflake ID');
    }
  }
}

/**
 * Shared SnowflakeService instance used throughout Flutry.
 *
 * Use this instance when a package needs to generate a Snowflake ID.
 */
export const snowflake = new SnowflakeService();
