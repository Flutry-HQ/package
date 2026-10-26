import argon2 from 'argon2';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { logger } from '../logger/logger';

const scryptAsync = promisify(crypto.scrypt);

export class EncryptionService {
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  private static readonly CACHE_MAX_SIZE = 100;
  private static readonly CACHE_TTL = 10 * 60 * 1000;

  private readonly keyCache = new Map<
    string,
    {
      key: Buffer;
      expiresAt: number;
    }
  >();

  private readonly pendingKeys = new Map<string, Promise<Buffer>>();

  /**
   * Hashes a password using Argon2id and encrypts
   * the resulting hash with AES-256-GCM.
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      const argon2Hash = await argon2.hash(password, {
        type: argon2.argon2id,
        timeCost: 6,
        memoryCost: 2 ** 17,
        parallelism: 2,
      });

      return await this.encrypt(argon2Hash);
    } catch (error) {
      logger.error('Failed to hash password', error);

      throw new Error('An error occurred while hashing the password');
    }
  }

  /**
   * Verifies a password against an encrypted Argon2id hash.
   */
  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const decryptedHash = await this.decrypt(hashedPassword);

      return await argon2.verify(decryptedHash, password);
    } catch (error) {
      logger.debug('Password comparison failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Resolves encryption credentials.
   */
  private getCredentials(secret?: string): {
    encryptionSecret: string;
    encryptionSalt: string;
  } {
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
  private getCacheId(secret: string, salt: string): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify([secret, salt]))
      .digest('hex');
  }

  /**
   * Removes expired entries and enforces
   * the maximum cache size.
   */
  private cleanupCache(): void {
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
  private async getKey(secret?: string): Promise<Buffer> {
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

    const derivation = (async (): Promise<Buffer> => {
      const derived = (await scryptAsync(encryptionSecret, encryptionSalt, EncryptionService.KEY_LENGTH)) as Buffer;

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
    } finally {
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
  public async encrypt(text: string, secret?: string): Promise<string> {
    try {
      const key = await this.getKey(secret);

      try {
        const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

        const tag = cipher.getAuthTag();

        return Buffer.concat([iv, tag, encrypted]).toString('base64');
      } finally {
        key.fill(0);
      }
    } catch (error) {
      logger.error('Failed to encrypt data', error);

      throw new Error('An error occurred while encrypting data');
    }
  }

  /**
   * Decrypts an AES-256-GCM encrypted Base64 value.
   *
   * Compatible with the previous synchronous
   * EncryptionService implementation.
   */
  public async decrypt(data: string, secret?: string): Promise<string> {
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

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

        decipher.setAuthTag(tag);

        return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
      } finally {
        key.fill(0);
      }
    } catch (error) {
      logger.error('Failed to decrypt data', error);

      throw new Error('An error occurred while decrypting data');
    }
  }

  /**
   * Clears cached encryption keys.
   *
   * Useful when rotating encryption credentials
   * or shutting down the application.
   */
  public clearCache(): void {
    for (const entry of this.keyCache.values()) {
      entry.key.fill(0);
    }

    this.keyCache.clear();
  }
}

/**
 * Shared EncryptionService instance.
 */
export const encryption = new EncryptionService();
