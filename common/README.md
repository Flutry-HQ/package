<div align="center">

<img src="./assets/logo.png" alt="Flutry Common" width="180" />

# @flutry/common

**Shared utilities and services for the Flutry ecosystem.**

A lightweight, reusable collection of utilities and services

for Node.js and TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@flutry/common.svg)](https://www.npmjs.com/package/@flutry/common)
[![license](https://img.shields.io/npm/l/@flutry/common.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the package

`@flutry/common` contains shared functionality that can be used across

Flutry packages and applications.

The goal is simple:

> Build commonly used functionality once, then make it easy to reuse everywhere.

The package currently provides:

- 📝 Structured logging
- 🔐 JWT token generation and verification
- 🆔 Snowflake ID generation
- 🔒 Password hashing and encryption
- 📦 TypeScript-focused API
- ⚡ Simple, ready-to-use instances

---

**## Installation**

```bash
npm install @flutry/common
```

```bash

```

With other package managers:

```bash
pnpm add @flutry/common
```

```bash
yarn add @flutry/common
```

---

# Features

## Logger

The built-in logger provides structured logging with multiple log levels,

colorized console output, and daily rotating log files.

```ts
import { logger } from '@flutry/common';

logger.info('Server started');

logger.warn('Configuration is missing', {
  key: 'PORT',
});

logger.error('Database connection failed', error);

logger.debug('User data loaded', {
  userId: 123,
});

logger.http('GET /users', {
  statusCode: 200,
});
```

### Log levels

| Level   | Purpose                                                |
| ------- | ------------------------------------------------------ |
| `error` | Errors that require attention                          |
| `warn`  | Unexpected situations that do not stop the application |
| `info`  | General application information                        |
| `http`  | HTTP and request-related logging                       |
| `debug` | Detailed development information                       |

### Logging errors

The logger supports multiple error handling formats:

```ts
logger.error(error);

logger.error(error, {
  userId: 123,
});

logger.error('Failed to create user', error, {
  userId: 123,
});
```

Error objects are processed automatically, and useful information such

as the stack trace is also included in the log.

### Log files

The default location for log files is:

```text
logs/
```

The files are rotated daily:

```text
logs/

├── 2026-08-28.log

├── 2026-08-29.log

└── ...
```

Log files are automatically rotated when the configured size is reached,

and old files are deleted based on the configured retention period.

### Environment variables

```env
LOG_LEVEL=info

NODE_ENV=production
```

By default:

- `info` in production
- `debug` in development

---

# JWT

`JWTService` provides a simple interface for creating, verifying, and

inspecting JSON Web Tokens.

```ts
import { jwt } from '@flutry/common';
```

## Generating a token

```ts
const token = jwt.generateToken({
  userId: 123,

  role: 'admin',
});
```

Every generated token automatically receives a unique random

identifier:

```ts
{

  userId: 123,

  role: 'admin',

  rand: '...'

}
```

This ensures that two tokens created with the same payload will still

be different.

### Custom expiration time

```ts
const token = jwt.generateToken(
  {
    userId: 123,
  },

  '15m',
);
```

Examples:

```text
30s

15m

1h

7d
```

## Verifying a token

```ts
const payload = jwt.verifyToken(token);
```

During verification, the token signature, expiration, and allowed

algorithm are checked.

The method throws an error if the token is invalid or expired.

## Decoding a token

```ts
const payload = jwt.decodeToken(token);
```

`decodeToken()` only reads the contents of the token.

**It does not verify the signature.**

If you want to use the token contents as trusted data,

you should use the `verifyToken()` method.

## Getting the token expiration

```ts
const expiration = jwt.getTokenExpiration(token);

console.log(expiration);
```

The method returns a JavaScript `Date` object.

### Environment variables

```env
JWT_SECRET_KEY=your-secret-key

JWT_EXPIRATION_TIME=1h
```

---

# Snowflake

The built-in Snowflake generator can create unique, sortable IDs

without requiring a counter stored in a database.

```ts
import { snowflake } from '@flutry/common';
```

## Generating an ID

```ts
const id = snowflake.generate();

console.log(id);
```

Example:

```text
124984573928475648
```

IDs are returned as strings because the size of a Snowflake ID

can exceed JavaScript's safely representable integer range.

## ID structure

A generated ID consists of three main parts:

```text
┌───────────────────────┬────────────────────┬──────────┐

│       Timestamp       │     Machine ID     │ Sequence │

└───────────────────────┴────────────────────┴──────────┘
```

The timestamp provides time-based ordering, the machine ID

separates application instances, and the sequence allows

multiple IDs to be generated within the same millisecond.

### Instance separation

The following values are used when creating the machine ID:

- the machine's MAC address
- a cryptographically secure random value

The random value is regenerated every time a `SnowflakeService` instance

is created.

This allows multiple application instances running on the same machine

to use different machine IDs.

---

# Encryption

The encryption service provides password hashing, password verification,

as well as symmetric encryption and decryption.

```ts
import { encryption } from '@flutry/common';
```

## Hashing a password

Passwords are hashed using Argon2id.

```ts
const hashedPassword = await encryption.hashPassword('my-password');
```

The generated hash is also encrypted before it is returned.

## Verifying a password

```ts
const valid = await encryption.comparePassword('my-password', hashedPassword);
```

The result:

```ts
true;
```

or:

```ts
false;
```

## Encrypting data

```ts
const encrypted = encryption.encrypt('secret data');
```

A custom secret can also be provided:

```ts
const encrypted = encryption.encrypt('secret data', 'custom-secret');
```

## Decrypting data

```ts
const decrypted = encryption.decrypt(encrypted);
```

### Environment variables

The default encryption key is derived from the following environment

variables:

```env
SECRET_KEY=your-secret-key

SECRET_SALT=your-secret-salt
```

These values must be kept confidential and should never be committed

to a Git repository.

---

# API

The package provides a simple public API through the `index.ts` entry

point.

```ts
import { logger, jwt, snowflake, encryption } from '@flutry/common';
```

This allows Flutry packages to access the functionality through a stable

public API without having to import internal files.

---

# TypeScript

`@flutry/common` is written entirely in TypeScript, and the package

also includes the required declaration files.

Type information is automatically available:

```ts
import { logger } from '@flutry/common';

logger.info('Hello');
```

VS Code and other TypeScript-compatible editors automatically

display types, parameters, and documentation through IntelliSense.

---

# Environment configuration

If you use all services, a typical Flutry application's environment

configuration may look like this:

```env
NODE_ENV=production

JWT_SECRET_KEY=your-jwt-secret

JWT_EXPIRATION_TIME=1h

SECRET_KEY=your-encryption-secret

SECRET_SALT=your-encryption-salt
```

Production secret values should never be committed to a Git repository.

---

# Design goals

The goal of `@flutry/common` is to make shared functionality simple,

stable, and consistent to use.

### Simple

Most functionality can be used with a single import:

```ts
import { logger, jwt, snowflake, encryption } from '@flutry/common';
```

### Reusable

The package can be used by multiple Flutry packages and applications.

### Type-safe

Every public API is built for TypeScript, and the package provides

the required declaration files.

### Predictable

Shared functionality behaves consistently across all Flutry projects.

---

# License

Apache License 2.0

The full license text is available in the [LICENSE](LICENSE) file.

---

<div align="center">

**Flutry Common**

Part of the Flutry ecosystem.

</div>
