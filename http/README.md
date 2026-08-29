<div align="center">

<img src="./assets/logo.png" alt="Flutry HTTP" width="180" />

# @flutry/http

**Fastify-based HTTP server for the Flutry ecosystem.**

A lightweight, structured HTTP server package built on top of Fastify
for Node.js and TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@flutry/http.svg)](https://www.npmjs.com/package/@flutry/http)

[![license](https://img.shields.io/npm/l/@flutry/http.svg?cacheSeconds=1)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the package

`@flutry/http` is the HTTP server layer of the Flutry ecosystem.

It provides a structured and reusable HTTP server implementation built on
top of Fastify, while exposing a Flutry-oriented API instead of requiring
applications to work directly with the underlying server implementation.

The package is designed to work together with the Flutry Router and other
Flutry packages.

The goal is simple:

> Provide a fast, reliable, and easy-to-use HTTP foundation for Flutry applications.

The package currently provides:

- 🌐 Fast HTTP server powered by Fastify
- 🛡️ Security-focused server configuration
- 📦 Compression support
- 🔌 Fastify plugin support
- 🧩 Integration with `@flutry/router`
- 📘 TypeScript-first API
- ⚡ Simple server initialization
- 🔧 Configurable server options

---

## Installation

```bash
npm install @flutry/http
```
