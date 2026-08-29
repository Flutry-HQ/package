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
export declare class SnowflakeService {
    /**
     * Machine identifier assigned to this service instance.
     *
     * It is generated lazily when the first ID is requested and remains
     * unchanged for the lifetime of this service instance.
     */
    private machineId;
    /**
     * Timestamp of the last generated ID.
     *
     * Used to guarantee that IDs are generated in chronological order
     * and to detect the system clock moving backwards.
     */
    private lastTimestamp;
    /**
     * Sequence number used when multiple IDs are generated within the
     * same millisecond.
     */
    private sequence;
    /**
     * Custom epoch used as the starting point for Snowflake timestamps.
     *
     * Using a custom epoch keeps the timestamp portion smaller than a
     * Unix timestamp while still providing a large usable time range.
     */
    private static readonly EPOCH;
    /**
     * Number of bits reserved for the machine identifier.
     *
     * 22 bits allow up to 4,194,304 different machine IDs.
     */
    private static readonly MACHINE_ID_BITS;
    /**
     * Number of bits reserved for the per-millisecond sequence.
     *
     * 6 bits allow up to 64 IDs to be generated within the same
     * millisecond by one service instance.
     */
    private static readonly SEQUENCE_BITS;
    /**
     * Maximum value that can be stored in the machine ID section.
     */
    private static readonly MAX_MACHINE_ID;
    /**
     * Maximum value that can be stored in the sequence section.
     */
    private static readonly MAX_SEQUENCE;
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
    private ensureMachineId;
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
    private getMacAddress;
    /**
     * Returns the number of milliseconds elapsed since the custom epoch.
     *
     * @returns Milliseconds since `SnowflakeService.EPOCH`.
     */
    private currentTimestamp;
    /**
     * Waits until the system clock reaches the next millisecond.
     *
     * This is used when the sequence counter is exhausted and another
     * ID cannot safely be generated within the current millisecond.
     *
     * @param lastTimestamp Timestamp that must be passed before continuing.
     * @returns The next available timestamp.
     */
    private waitNextMillis;
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
    generate(): string;
}
/**
 * Shared SnowflakeService instance used throughout Flutry.
 *
 * Use this instance when a package needs to generate a Snowflake ID.
 */
export declare const snowflake: SnowflakeService;
