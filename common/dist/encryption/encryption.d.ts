/**
 * Provides password hashing and symmetric encryption utilities.
 *
 * Passwords are hashed with Argon2id and the resulting hash is encrypted
 * with AES-256-GCM before it is returned. Encryption uses a key derived
 * from `SECRET_KEY` and `SECRET_SALT` through Node.js scrypt.
 *
 * The encrypted value contains the IV, authentication tag and ciphertext,
 * encoded as a single Base64 string.
 */
export declare class EncryptionService {
    /**
     * Creates a secure password hash.
     *
     * Argon2id is used for password hashing with a deliberately expensive
     * configuration to make brute-force and password cracking attempts more
     * difficult. The generated Argon2 hash is then encrypted before being
     * returned.
     *
     * @param password Plain-text password to hash.
     * @returns An encrypted Argon2id password hash.
     * @throws If hashing fails or the encryption configuration is missing.
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Checks whether a plain-text password matches an encrypted password hash.
     *
     * The stored value is first decrypted to recover the Argon2id hash,
     * then Argon2 verifies the supplied password against it.
     *
     * A failed comparison returns `false`. Decryption errors, invalid hashes
     * and other verification failures are also treated as a failed comparison.
     *
     * @param password Plain-text password to verify.
     * @param hashedPassword Encrypted Argon2id hash returned by {@link hashPassword}.
     * @returns `true` when the password matches, otherwise `false`.
     */
    comparePassword(password: string, hashedPassword: string): Promise<boolean>;
    /**
     * Derives the AES-256 encryption key.
     *
     * When a custom secret is not supplied, `SECRET_KEY` is read from the
     * environment. `SECRET_SALT` is always required. Both values are passed
     * through scrypt to produce the 32-byte key required by AES-256.
     *
     * @param secret Optional secret used instead of `SECRET_KEY`.
     * @returns A 32-byte encryption key.
     * @throws If `SECRET_KEY` or `SECRET_SALT` is missing.
     */
    private getKey;
    /**
     * Encrypts text using AES-256-GCM.
     *
     * A new random 12-byte IV is generated for every encryption operation.
     * AES-GCM also produces an authentication tag, which protects the
     * encrypted data from being modified without detection.
     *
     * The resulting binary data is stored in the following format:
     *
     * `[12-byte IV][16-byte authentication tag][ciphertext]`
     *
     * The complete value is encoded as Base64 so it can be safely stored
     * in a database or passed as a string.
     *
     * @param text Text to encrypt.
     * @param secret Optional secret used instead of `SECRET_KEY`.
     * @returns Base64-encoded encrypted data.
     * @throws If encryption fails or the encryption configuration is missing.
     */
    encrypt(text: string, secret?: string): string;
    /**
     * Decrypts data previously encrypted with {@link encrypt}.
     *
     * The method extracts the IV and authentication tag from the Base64
     * encoded value and uses them to decrypt and authenticate the ciphertext.
     *
     * AES-GCM authentication ensures that modified or corrupted encrypted
     * data cannot be decrypted successfully.
     *
     * @param data Base64-encoded encrypted data.
     * @param secret Optional secret used instead of `SECRET_KEY`.
     * @returns The original decrypted text.
     * @throws If the encrypted data is invalid, authentication fails, or the
     * encryption configuration is missing.
     */
    decrypt(data: string, secret?: string): string;
}
/**
 * Shared EncryptionService instance used throughout the application.
 */
export declare const encryption: EncryptionService;
