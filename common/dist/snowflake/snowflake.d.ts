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
export declare class SnowflakeService {
    /**
     * Machine identifier assigned to this generator.
     */
    private machineId;
    /**
     * Last logical timestamp used to generate an ID.
     */
    private lastTimestamp;
    /**
     * Sequence counter for IDs generated in the same millisecond.
     */
    private sequence;
    /**
     * Custom epoch: January 1, 2023, 00:00:00 UTC.
     */
    private static readonly EPOCH;
    /**
     * Machine identifier bit allocation.
     */
    private static readonly MACHINE_ID_BITS;
    /**
     * Per-millisecond sequence bit allocation.
     */
    private static readonly SEQUENCE_BITS;
    /**
     * Maximum machine identifier.
     */
    private static readonly MAX_MACHINE_ID;
    /**
     * Maximum sequence number.
     */
    private static readonly MAX_SEQUENCE;
    /**
     * Initializes the machine identifier.
     *
     * Priority:
     * 1. Explicit SNOWFLAKE_MACHINE_ID environment variable
     * 2. Randomly generated identifier
     */
    private ensureMachineId;
    /**
     * Retrieves the first available non-internal MAC address.
     *
     * Falls back to a zero MAC if no suitable interface exists.
     */
    private getMacAddress;
    /**
     * Returns milliseconds elapsed since the custom epoch.
     */
    private currentTimestamp;
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
    generate(): string;
}
/**
 * Shared Snowflake generator for Flutry applications.
 */
export declare const snowflake: SnowflakeService;
