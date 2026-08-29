"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryption = exports.EncryptionService = void 0;
const argon2_1 = __importDefault(require("argon2"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../logger/logger");
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
class EncryptionService {
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
    async hashPassword(password) {
        try {
            const argon2Hash = await argon2_1.default.hash(password, {
                type: argon2_1.default.argon2id,
                timeCost: 6,
                memoryCost: 2 ** 17,
                parallelism: 2,
            });
            return this.encrypt(argon2Hash);
        }
        catch (error) {
            logger_1.logger.error('Failed to hash password', error);
            throw new Error('An error occurred while hashing the password');
        }
    }
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
    async comparePassword(password, hashedPassword) {
        try {
            const decryptedHash = this.decrypt(hashedPassword);
            return await argon2_1.default.verify(decryptedHash, password);
        }
        catch (error) {
            logger_1.logger.debug('Password comparison failed', {
                error: error instanceof Error ? error.message : error,
            });
            return false;
        }
    }
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
    getKey(secret) {
        const encryptionSecret = secret ?? process.env.SECRET_KEY;
        const encryptionSalt = process.env.SECRET_SALT;
        if (!encryptionSecret) {
            const error = new Error('SECRET_KEY is not defined in environment variables');
            logger_1.logger.error('Encryption secret is missing', error);
            throw error;
        }
        if (!encryptionSalt) {
            const error = new Error('SECRET_SALT is not defined in environment variables');
            logger_1.logger.error('Encryption salt is missing', error);
            throw error;
        }
        return crypto_1.default.scryptSync(encryptionSecret, encryptionSalt, 32);
    }
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
    encrypt(text, secret) {
        try {
            const key = this.getKey(secret);
            const iv = crypto_1.default.randomBytes(12);
            const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const tag = cipher.getAuthTag();
            return Buffer.concat([iv, tag, encrypted]).toString('base64');
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt data', error);
            throw new Error('An error occurred while encrypting data');
        }
    }
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
    decrypt(data, secret) {
        try {
            const key = this.getKey(secret);
            const buffer = Buffer.from(data, 'base64');
            if (buffer.length < 28) {
                throw new Error('Invalid encrypted data');
            }
            const iv = buffer.subarray(0, 12);
            const tag = buffer.subarray(12, 28);
            const text = buffer.subarray(28);
            const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            return decipher.update(text, undefined, 'utf8') + decipher.final('utf8');
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt data', error);
            throw new Error('An error occurred while decrypting data');
        }
    }
}
exports.EncryptionService = EncryptionService;
/**
 * Shared EncryptionService instance used throughout the application.
 */
exports.encryption = new EncryptionService();
