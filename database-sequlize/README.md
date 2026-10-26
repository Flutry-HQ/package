<div align="center">

<img src="./assets/logo.png" alt="Flutry Database Sequelize" width="180" />

# @flutry/database-sequlize

**Sequelize database integration for the Flutry ecosystem.**

A structured, TypeScript-first database package built on top of Sequelize
for Node.js applications using MySQL or MariaDB.

[![npm version](https://img.shields.io/npm/v/@flutry/database-sequlize.svg)](https://www.npmjs.com/package/@flutry/database-sequlize)
[![license](https://img.shields.io/npm/l/@flutry/database-sequlize.svg?cacheSeconds=1)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the Package

`@flutry/database-sequlize` provides the Sequelize database layer for
the Flutry ecosystem.

The package handles database connection management, automatic model
discovery, model initialization, associations, schema synchronization,
and connection retries.

It is designed to provide a simple and consistent database API without
requiring applications to repeatedly implement common Sequelize logic.

The goal is simple:

> Provide a reliable and structured Sequelize foundation for Flutry applications.

### Features

- 🗄️ Sequelize database integration
- 🐬 MySQL support
- 🦭 MariaDB support
- 🔄 Connection retry support
- 📂 Automatic model discovery
- 🔗 Model association initialization
- 🔄 Development schema synchronization
- 💾 Sequelize transaction support
- 📘 TypeScript-first API
- ⚡ Asynchronous database initialization
- 🛑 Graceful connection shutdown

---

## Installation

```bash
npm install @flutry/database-sequlize
```
