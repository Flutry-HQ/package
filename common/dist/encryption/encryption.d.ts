export declare class EncryptionService {
    private static readonly KEY_LENGTH;
    private static readonly IV_LENGTH;
    private static readonly TAG_LENGTH;
    private static readonly CACHE_MAX_SIZE;
    private static readonly CACHE_TTL;
    private readonly keyCache;
    private readonly pendingKeys;
    /**
     * Hashes a password using Argon2id and encrypts
     * the resulting hash with AES-256-GCM.
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verifies a password against an encrypted Argon2id hash.
     */
    comparePassword(password: string, hashedPassword: string): Promise<boolean>;
    /**
     * Resolves encryption credentials.
     */
    private getCredentials;
    /**
     * Generates a fixed-length cache identifier.
     *
     * Raw encryption secrets are not stored as Map keys.
     */
    private getCacheId;
    /**
     * Removes expired entries and enforces
     * the maximum cache size.
     */
    private cleanupCache;
    /**
     * Derives an AES-256 key asynchronously.
     *
     * Identical concurrent derivations share
     * the same pending Promise.
     */
    private getKey;
    /**
     * Encrypts UTF-8 text using AES-256-GCM.
     *
     * Output format:
     * [12-byte IV][16-byte authentication tag][ciphertext]
     *
     * The complete result is Base64 encoded.
     */
    encrypt(text: string, secret?: string): Promise<string>;
    /**
     * Decrypts an AES-256-GCM encrypted Base64 value.
     *
     * Compatible with the previous synchronous
     * EncryptionService implementation.
     */
    decrypt(data: string, secret?: string): Promise<string>;
    /**
     * Clears cached encryption keys.
     *
     * Useful when rotating encryption credentials
     * or shutting down the application.
     */
    clearCache(): void;
}
/**
 * Shared EncryptionService instance.
 */
export declare const encryption: EncryptionService;
