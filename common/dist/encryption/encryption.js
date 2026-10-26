"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryption = exports.EncryptionService = void 0;
const argon2_1 = __importDefault(require("argon2"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_util_1 = require("node:util");
const logger_1 = require("../logger/logger");
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.default.scrypt);
class EncryptionService {
    constructor() {
        this.keyCache = new Map();
        this.pendingKeys = new Map();
    }
    /**
     * Hashes a password using Argon2id and encrypts
     * the resulting hash with AES-256-GCM.
     */
    async hashPassword(password) {
        try {
            const argon2Hash = await argon2_1.default.hash(password, {
                type: argon2_1.default.argon2id,
                timeCost: 6,
                memoryCost: 2 ** 17,
                parallelism: 2,
            });
            return await this.encrypt(argon2Hash);
        }
        catch (error) {
            logger_1.logger.error('Failed to hash password', error);
            throw new Error('An error occurred while hashing the password');
        }
    }
    /**
     * Verifies a password against an encrypted Argon2id hash.
     */
    async comparePassword(password, hashedPassword) {
        try {
            const decryptedHash = await this.decrypt(hashedPassword);
            return await argon2_1.default.verify(decryptedHash, password);
        }
        catch (error) {
            logger_1.logger.debug('Password comparison failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    /**
     * Resolves encryption credentials.
     */
    getCredentials(secret) {
        const encryptionSecret = secret ?? process.env.SECRET_KEY;
        const encryptionSalt = process.env.SECRET_SALT;
        if (!encryptionSecret) {
            throw new Error('SECRET_KEY is not defined in environment variables');
        }
        if (!encryptionSalt) {
            throw new Error('SECRET_SALT is not defined in environment variables');
        }
        return {
            encryptionSecret,
            encryptionSalt,
        };
    }
    /**
     * Generates a fixed-length cache identifier.
     *
     * Raw encryption secrets are not stored as Map keys.
     */
    getCacheId(secret, salt) {
        return node_crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify([secret, salt]))
            .digest('hex');
    }
    /**
     * Removes expired entries and enforces
     * the maximum cache size.
     */
    cleanupCache() {
        const now = Date.now();
        for (const [id, entry] of this.keyCache) {
            if (entry.expiresAt <= now) {
                entry.key.fill(0);
                this.keyCache.delete(id);
            }
        }
        while (this.keyCache.size >= EncryptionService.CACHE_MAX_SIZE) {
            const oldestId = this.keyCache.keys().next().value;
            if (oldestId === undefined) {
                break;
            }
            const entry = this.keyCache.get(oldestId);
            if (entry) {
                entry.key.fill(0);
            }
            this.keyCache.delete(oldestId);
        }
    }
    /**
     * Derives an AES-256 key asynchronously.
     *
     * Identical concurrent derivations share
     * the same pending Promise.
     */
    async getKey(secret) {
        const { encryptionSecret, encryptionSalt } = this.getCredentials(secret);
        const cacheId = this.getCacheId(encryptionSecret, encryptionSalt);
        const cached = this.keyCache.get(cacheId);
        if (cached) {
            if (cached.expiresAt > Date.now()) {
                // Refresh LRU order.
                this.keyCache.delete(cacheId);
                this.keyCache.set(cacheId, cached);
                return Buffer.from(cached.key);
            }
            cached.key.fill(0);
            this.keyCache.delete(cacheId);
        }
        const pending = this.pendingKeys.get(cacheId);
        if (pending) {
            return Buffer.from(await pending);
        }
        const derivation = (async () => {
            const derived = (await scryptAsync(encryptionSecret, encryptionSalt, EncryptionService.KEY_LENGTH));
            this.cleanupCache();
            this.keyCache.set(cacheId, {
                key: derived,
                expiresAt: Date.now() + EncryptionService.CACHE_TTL,
            });
            return derived;
        })();
        this.pendingKeys.set(cacheId, derivation);
        try {
            return Buffer.from(await derivation);
        }
        finally {
            this.pendingKeys.delete(cacheId);
        }
    }
    /**
     * Encrypts UTF-8 text using AES-256-GCM.
     *
     * Output format:
     * [12-byte IV][16-byte authentication tag][ciphertext]
     *
     * The complete result is Base64 encoded.
     */
    async encrypt(text, secret) {
        try {
            const key = await this.getKey(secret);
            try {
                const iv = node_crypto_1.default.randomBytes(EncryptionService.IV_LENGTH);
                const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
                const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
                const tag = cipher.getAuthTag();
                return Buffer.concat([iv, tag, encrypted]).toString('base64');
            }
            finally {
                key.fill(0);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to encrypt data', error);
            throw new Error('An error occurred while encrypting data');
        }
    }
    /**
     * Decrypts an AES-256-GCM encrypted Base64 value.
     *
     * Compatible with the previous synchronous
     * EncryptionService implementation.
     */
    async decrypt(data, secret) {
        try {
            const key = await this.getKey(secret);
            try {
                const buffer = Buffer.from(data, 'base64');
                const minimumLength = EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH;
                if (buffer.length < minimumLength) {
                    throw new Error('Invalid encrypted data');
                }
                const iv = buffer.subarray(0, EncryptionService.IV_LENGTH);
                const tag = buffer.subarray(EncryptionService.IV_LENGTH, minimumLength);
                const encrypted = buffer.subarray(minimumLength);
                const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(tag);
                return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
            }
            finally {
                key.fill(0);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to decrypt data', error);
            throw new Error('An error occurred while decrypting data');
        }
    }
    /**
     * Clears cached encryption keys.
     *
     * Useful when rotating encryption credentials
     * or shutting down the application.
     */
    clearCache() {
        for (const entry of this.keyCache.values()) {
            entry.key.fill(0);
        }
        this.keyCache.clear();
    }
}
exports.EncryptionService = EncryptionService;
EncryptionService.KEY_LENGTH = 32;
EncryptionService.IV_LENGTH = 12;
EncryptionService.TAG_LENGTH = 16;
EncryptionService.CACHE_MAX_SIZE = 100;
EncryptionService.CACHE_TTL = 10 * 60 * 1000;
/**
 * Shared EncryptionService instance.
 */
exports.encryption = new EncryptionService();
