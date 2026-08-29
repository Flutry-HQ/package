"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwt = exports.JWTService = void 0;
const jsonwebtoken_1 = __importStar(require("jsonwebtoken"));
const parse_duration_1 = __importDefault(require("parse-duration"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../logger/logger");
class JWTService {
    /**
     * Returns the configured JWT secret key.
     *
     * @returns The configured JWT secret key.
     * @throws If `JWT_SECRET_KEY` is not defined.
     */
    getSecretKey() {
        if (JWTService.SECRET_KEY === null) {
            const error = new Error('JWT_SECRET_KEY is not defined in environment variables');
            logger_1.logger.error('JWT secret key is missing', error);
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
    generateToken(payload, time) {
        const enhancedPayload = {
            ...payload,
            rand: crypto_1.default.randomUUID(),
        };
        const parsedDuration = time ? (0, parse_duration_1.default)(time) : (0, parse_duration_1.default)(JWTService.EXPIRATION_TIME);
        if (!parsedDuration) {
            const error = new Error(`Invalid JWT expiration time: ${time ?? JWTService.EXPIRATION_TIME}`);
            logger_1.logger.error('Failed to parse JWT expiration time', error);
            throw error;
        }
        return jsonwebtoken_1.default.sign(enhancedPayload, this.getSecretKey(), {
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
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.getSecretKey(), {
                algorithms: [JWTService.ALGORITHM],
            });
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.TokenExpiredError) {
                logger_1.logger.debug('JWT token has expired');
                throw new Error('Token has expired');
            }
            if (error instanceof jsonwebtoken_1.NotBeforeError) {
                logger_1.logger.debug('JWT token is not active yet');
                throw new Error('Token is not active yet');
            }
            if (error instanceof jsonwebtoken_1.JsonWebTokenError) {
                logger_1.logger.debug('Invalid JWT token');
                throw new Error('Invalid token');
            }
            logger_1.logger.error('Unexpected JWT verification error', error);
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
    decodeToken(token) {
        this.getSecretKey();
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch (error) {
            logger_1.logger.error('Failed to decode JWT token', error);
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
    getTokenExpiration(token) {
        const payload = this.decodeToken(token);
        if (payload && typeof payload === 'object' && 'exp' in payload && typeof payload.exp === 'number') {
            return new Date(payload.exp * 1000);
        }
        const error = new Error('JWT token does not contain a valid expiration');
        logger_1.logger.error('Failed to get JWT token expiration', error);
        throw error;
    }
}
exports.JWTService = JWTService;
/**
 * Secret key used to sign and verify JWTs.
 *
 * The value is read from the `JWT_SECRET_KEY` environment variable.
 */
JWTService.SECRET_KEY = process.env.JWT_SECRET_KEY || null;
/**
 * Algorithm used for signing and verifying tokens.
 *
 * HS256 uses the same secret key for both operations.
 */
JWTService.ALGORITHM = 'HS256';
/**
 * Default token lifetime.
 *
 * Can be overridden with the `JWT_EXPIRATION_TIME` environment variable.
 */
JWTService.EXPIRATION_TIME = process.env.JWT_EXPIRATION_TIME || '1h';
/**
 * Shared JWTService instance used throughout the application.
 */
exports.jwt = new JWTService();
