import 'dotenv/config';
import { JwtPayload } from 'jsonwebtoken';
/**
 * Custom data stored inside a JWT payload.
 *
 * The payload is extended with a unique `rand` value when a token is
 * generated, ensuring that two tokens created with the same payload
 * are still different.
 */
export type JWTPayload = Record<string, unknown>;
export declare class JWTService {
    /**
     * Secret key used to sign and verify JWTs.
     *
     * The value is read from the `JWT_SECRET_KEY` environment variable.
     */
    private static readonly SECRET_KEY;
    /**
     * Algorithm used for signing and verifying tokens.
     *
     * HS256 uses the same secret key for both operations.
     */
    private static readonly ALGORITHM;
    /**
     * Default token lifetime.
     *
     * Can be overridden with the `JWT_EXPIRATION_TIME` environment variable.
     */
    private static readonly EXPIRATION_TIME;
    /**
     * Returns the configured JWT secret key.
     *
     * @returns The configured JWT secret key.
     * @throws If `JWT_SECRET_KEY` is not defined.
     */
    private getSecretKey;
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
    generateToken(payload: JWTPayload, time?: string): string;
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
    verifyToken(token: string): JwtPayload | string;
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
    decodeToken(token: string): JwtPayload | string | null;
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
    getTokenExpiration(token: string): Date;
}
/**
 * Shared JWTService instance used throughout the application.
 */
export declare const jwt: JWTService;
