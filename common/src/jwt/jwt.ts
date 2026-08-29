import jsonwebtoken, { Algorithm, JwtPayload, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import parseDuration from 'parse-duration';
import crypto from 'crypto';

import { logger } from '../logger/logger';

/**
 * Custom data stored inside a JWT payload.
 *
 * The payload is extended with a unique `rand` value when a token is
 * generated, ensuring that two tokens created with the same payload
 * are still different.
 */
export type JWTPayload = Record<string, unknown>;

export class JWTService {
  /**
   * Secret key used to sign and verify JWTs.
   *
   * The value is read from the `JWT_SECRET_KEY` environment variable.
   */
  private static readonly SECRET_KEY = process.env.JWT_SECRET_KEY || null;

  /**
   * Algorithm used for signing and verifying tokens.
   *
   * HS256 uses the same secret key for both operations.
   */
  private static readonly ALGORITHM: Algorithm = 'HS256';

  /**
   * Default token lifetime.
   *
   * Can be overridden with the `JWT_EXPIRATION_TIME` environment variable.
   */
  private static readonly EXPIRATION_TIME = process.env.JWT_EXPIRATION_TIME || '1h';

  /**
   * Returns the configured JWT secret key.
   *
   * @returns The configured JWT secret key.
   * @throws If `JWT_SECRET_KEY` is not defined.
   */
  private getSecretKey(): string {
    if (JWTService.SECRET_KEY === null) {
      const error = new Error('JWT_SECRET_KEY is not defined in environment variables');

      logger.error('JWT secret key is missing', error);

      throw error;
    }

    return JWTService.SECRET_KEY;
  }

  /**
   * Generates a signed JWT.
   *
   * A unique UUID is automatically added to the payload as `rand`.
   * This means that generating multiple tokens with the same payload
   * will still produce different tokens.
   *
   * The token lifetime can be specified for an individual token.
   * When no lifetime is provided, `JWT_EXPIRATION_TIME` is used.
   *
   * @param payload Data to store inside the JWT.
   * @param time Optional token lifetime, such as `15m`, `1h` or `7d`.
   * @returns A signed JWT string.
   * @throws If the secret key is missing or the expiration time is invalid.
   */
  generateToken(payload: JWTPayload, time?: string): string {
    const enhancedPayload = {
      ...payload,
      rand: crypto.randomUUID(),
    };

    const parsedDuration = time ? parseDuration(time) : parseDuration(JWTService.EXPIRATION_TIME);

    if (!parsedDuration) {
      const error = new Error(`Invalid JWT expiration time: ${time ?? JWTService.EXPIRATION_TIME}`);

      logger.error('Failed to parse JWT expiration time', error);

      throw error;
    }

    return jsonwebtoken.sign(enhancedPayload, this.getSecretKey(), {
      expiresIn: parsedDuration / 1000,
      algorithm: JWTService.ALGORITHM,
    });
  }

  /**
   * Verifies a JWT signature and validates its expiration.
   *
   * Only the configured HS256 algorithm is accepted. The decoded
   * payload is returned when the token is valid.
   *
   * Expired, inactive and otherwise invalid tokens result in an error.
   *
   * @param token JWT string to verify.
   * @returns The verified JWT payload.
   * @throws If the token is expired, inactive, invalid or cannot be verified.
   */
  verifyToken(token: string): JwtPayload | string {
    try {
      return jsonwebtoken.verify(token, this.getSecretKey(), {
        algorithms: [JWTService.ALGORITHM],
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        logger.debug('JWT token has expired');

        throw new Error('Token has expired');
      }

      if (error instanceof NotBeforeError) {
        logger.debug('JWT token is not active yet');

        throw new Error('Token is not active yet');
      }

      if (error instanceof JsonWebTokenError) {
        logger.debug('Invalid JWT token');

        throw new Error('Invalid token');
      }

      logger.error('Unexpected JWT verification error', error);

      throw new Error('Failed to verify token');
    }
  }

  /**
   * Decodes a JWT without verifying its signature.
   *
   * This method should only be used when the token's authenticity does
   * not need to be established. Use {@link verifyToken} when the token
   * must be trusted.
   *
   * @param token JWT string to decode.
   * @returns The decoded payload, a string payload, or `null` when decoding fails.
   * @throws If the JWT secret is not configured or decoding fails.
   */
  decodeToken(token: string): JwtPayload | string | null {
    this.getSecretKey();

    try {
      return jsonwebtoken.decode(token);
    } catch (error) {
      logger.error('Failed to decode JWT token', error);

      throw new Error('Invalid token');
    }
  }

  /**
   * Returns the expiration date of a JWT.
   *
   * The token is decoded to read its `exp` claim. This method does not
   * verify the token signature, so it should not be used to determine
   * whether a token is trustworthy.
   *
   * @param token JWT string to inspect.
   * @returns The expiration date stored in the token.
   * @throws If the token does not contain a valid `exp` claim.
   */
  getTokenExpiration(token: string): Date {
    const payload = this.decodeToken(token);

    if (payload && typeof payload === 'object' && 'exp' in payload && typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000);
    }

    const error = new Error('JWT token does not contain a valid expiration');

    logger.error('Failed to get JWT token expiration', error);

    throw error;
  }
}

/**
 * Shared JWTService instance used throughout the application.
 */
export const jwt = new JWTService();
