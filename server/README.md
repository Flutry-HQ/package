<div align="center">

<img src="./assets/logo.png" alt="Flutry Server" width="180" />

# @flutry/server

**Fastify-based server for the Flutry ecosystem.**

A lightweight, structured HTTP server package built on top of Fastify
for Node.js and TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@flutry/server.svg)](https://www.npmjs.com/package/@flutry/server)
[![license](https://img.shields.io/npm/l/@flutry/server.svg?cacheSeconds=1)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the package

`@flutry/server` is the server layer of the Flutry ecosystem.

It provides a structured and reusable HTTP server implementation built on
top of Fastify, while exposing a Flutry-oriented API instead of requiring
applications to work directly with the underlying server implementation.

The package also includes the Flutry Router integration, providing
automatic route loading, request context handling, and route registration.

The goal is simple:

> Provide a fast, reliable, and structured server foundation for Flutry applications.

The package currently provides:

- 🌐 Fast HTTP server powered by Fastify
- 🛡️ Security-focused server configuration
- 📦 Compression support
- 🔌 Fastify plugin support
- 🧭 Integrated Flutry Router
- 📂 Automatic route loading
- 🧩 Request context handling
- 📘 TypeScript-first API
- ⚡ Simple server initialization
- 🔧 Configurable server options

---

## Installation

```bash
npm install @flutry/server
```
