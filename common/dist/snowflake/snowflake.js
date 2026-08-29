"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snowflake = exports.SnowflakeService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const os_1 = require("os");
const logger_1 = require("../logger/logger");
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
class SnowflakeService {
    constructor() {
        /**
         * Timestamp of the last generated ID.
         *
         * Used to guarantee that IDs are generated in chronological order
         * and to detect the system clock moving backwards.
         */
        this.lastTimestamp = -1;
        /**
         * Sequence number used when multiple IDs are generated within the
         * same millisecond.
         */
        this.sequence = 0;
    }
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
    ensureMachineId() {
        if (this.machineId !== undefined) {
            return;
        }
        try {
            const machineKey = crypto_1.default.randomBytes(32).toString('hex');
            const mac = this.getMacAddress();
            const hash = crypto_1.default.createHash('sha256').update(`${mac}:${machineKey}`).digest();
            this.machineId = hash.readUInt32BE(0) % (SnowflakeService.MAX_MACHINE_ID + 1);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Snowflake machine ID', error);
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
    getMacAddress() {
        try {
            const interfaces = (0, os_1.networkInterfaces)();
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
        }
        catch (error) {
            logger_1.logger.warn('Failed to retrieve network interface information', error instanceof Error ? { error: error.message } : { error });
            return '00:00:00:00:00:00';
        }
    }
    /**
     * Returns the number of milliseconds elapsed since the custom epoch.
     *
     * @returns Milliseconds since `SnowflakeService.EPOCH`.
     */
    currentTimestamp() {
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
    waitNextMillis(lastTimestamp) {
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
    generate() {
        try {
            this.ensureMachineId();
            let timestamp = this.currentTimestamp();
            if (timestamp < this.lastTimestamp) {
                const error = new Error('Clock moved backwards. Refusing to generate ID');
                logger_1.logger.error('Snowflake clock moved backwards', error);
                throw error;
            }
            if (timestamp === this.lastTimestamp) {
                this.sequence++;
                if (this.sequence > SnowflakeService.MAX_SEQUENCE) {
                    timestamp = this.waitNextMillis(this.lastTimestamp);
                    this.sequence = 0;
                }
            }
            else {
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
            const id = (BigInt(timestamp) << BigInt(SnowflakeService.MACHINE_ID_BITS + SnowflakeService.SEQUENCE_BITS)) |
                (BigInt(this.machineId) << BigInt(SnowflakeService.SEQUENCE_BITS)) |
                BigInt(this.sequence);
            return id.toString();
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Clock moved backwards. Refusing to generate ID') {
                throw error;
            }
            logger_1.logger.error('Failed to generate Snowflake ID', error);
            throw new Error('Failed to generate Snowflake ID');
        }
    }
}
exports.SnowflakeService = SnowflakeService;
/**
 * Custom epoch used as the starting point for Snowflake timestamps.
 *
 * Using a custom epoch keeps the timestamp portion smaller than a
 * Unix timestamp while still providing a large usable time range.
 */
SnowflakeService.EPOCH = 1672531200000;
/**
 * Number of bits reserved for the machine identifier.
 *
 * 22 bits allow up to 4,194,304 different machine IDs.
 */
SnowflakeService.MACHINE_ID_BITS = 22;
/**
 * Number of bits reserved for the per-millisecond sequence.
 *
 * 6 bits allow up to 64 IDs to be generated within the same
 * millisecond by one service instance.
 */
SnowflakeService.SEQUENCE_BITS = 6;
/**
 * Maximum value that can be stored in the machine ID section.
 */
SnowflakeService.MAX_MACHINE_ID = 2 ** SnowflakeService.MACHINE_ID_BITS - 1;
/**
 * Maximum value that can be stored in the sequence section.
 */
SnowflakeService.MAX_SEQUENCE = 2 ** SnowflakeService.SEQUENCE_BITS - 1;
/**
 * Shared SnowflakeService instance used throughout Flutry.
 *
 * Use this instance when a package needs to generate a Snowflake ID.
 */
exports.snowflake = new SnowflakeService();
