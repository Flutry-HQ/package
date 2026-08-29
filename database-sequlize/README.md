<div align="center">

<img src="./assets/logo.png" alt="Flutry Database Sequelize" width="180" />

# @flutry/database-sequelize

**Sequelize database integration for the Flutry ecosystem.**

A structured, TypeScript-first database package built on top of Sequelize
for Node.js applications using MySQL or MariaDB.

[![npm version](https://img.shields.io/npm/v/@flutry/database-sequelize.svg)](https://www.npmjs.com/package/@flutry/database-sequelize)

[![license](https://img.shields.io/npm/l/@flutry/database-sequelize.svg?cacheSeconds=1)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

## About the package

`@flutry/database-sequelize` provides the Sequelize database layer for
the Flutry ecosystem.

The package handles database connection management, automatic model
discovery, model initialization, associations, schema synchronization,
connection retries, and common database operations.

It is designed to provide a simple and consistent database API without
requiring applications to repeatedly implement common Sequelize logic.

The goal is simple:

> Provide a reliable and structured Sequelize foundation for Flutry applications.

The package currently provides:

- 🗄️ Sequelize database integration
- 🐬 MySQL support
- 🦭 MariaDB support
- 🔄 Automatic connection retry
- 📂 Automatic model discovery
- 🔗 Model association initialization
- 🔄 Automatic schema synchronization
- 🧩 Common database operations
- 💾 Transaction support
- 📘 TypeScript-first API
- ⚡ Simple database initialization

---

# Installation

```bash
npm install @flutry/database-sequelize
```
