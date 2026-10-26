import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';

import { logger } from '@flutry/common';

export interface ModelsOptions {
  sequelize: Sequelize;
  sync?: boolean;
}

/**
 * Automatically discovers, initializes, and optionally
 * synchronizes Sequelize models used by the application.
 *
 * Models are loaded from the application's `src/models` directory
 * when available, otherwise from `dist/models`.
 *
 * Model files must follow the `.model` naming convention and expose
 * a default class with a static `initialize()` method.
 *
 * Synchronization behavior:
 *
 * - Development: always sync with alter: true
 * - Production: sync only when explicitly enabled
 * - Other environments: sync only when explicitly enabled
 */
export default class Models {
  /**
   * Collection of discovered Sequelize models.
   */
  private readonly models: Record<string, any> = {};

  /**
   * Sequelize instance associated with this model loader.
   */
  private readonly sequelize: Sequelize;

  /**
   * Whether normal synchronization is enabled outside development.
   */
  private readonly sync: boolean;

  constructor(options: ModelsOptions) {
    this.sequelize = options.sequelize;
    this.sync = options.sync ?? false;
  }

  /**
   * Determines whether the application is running
   * in development mode.
   */
  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Discovers and initializes models, configures their
   * associations, and synchronizes the database when required.
   */
  public async init(): Promise<void> {
    const sourceDir = path.join(process.cwd(), 'src/models');
    const buildDir = path.join(process.cwd(), 'dist/models');

    const modelsDir = (await this.directoryExists(sourceDir)) ? sourceDir : buildDir;

    if (!(await this.directoryExists(modelsDir))) {
      throw new Error(`Models directory was not found: ${modelsDir}`);
    }

    /**
     * Load all models before configuring associations.
     */
    await this.initModels(modelsDir);

    /**
     * Configure associations after all models have
     * been initialized.
     */
    for (const modelName of Object.keys(this.models)) {
      const model = this.models[modelName];

      if (typeof model.associate === 'function') {
        await model.associate(this.models);
      }
    }

    /**
     * Development always uses alter: true.
     *
     * This behavior cannot be disabled using the sync option.
     */
    if (this.isDevelopment()) {
      try {
        await this.sequelize.sync({ alter: true });

        logger.info('Development database models synchronized with alter: true.');
      } catch (error) {
        logger.error('Unable to synchronize development database models:', error);

        throw error;
      }

      return;
    }

    /**
     * Outside development, synchronization is opt-in.
     */
    if (!this.sync) {
      logger.info('Database models initialized. Automatic synchronization is disabled.');

      return;
    }

    try {
      await this.sequelize.sync();

      logger.info('Database models synchronized successfully.');
    } catch (error) {
      logger.error('Unable to synchronize database models:', error);

      throw error;
    }
  }

  /**
   * Recursively searches a directory for Sequelize model files.
   *
   * Supported extensions:
   * - .ts
   * - .js
   * - .mjs
   * - .cjs
   */
  private async initModels(dir: string): Promise<void> {
    const files = await fs.readdir(dir, {
      withFileTypes: true,
    });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await this.initModels(filePath);
        continue;
      }

      if (/\.model\.(ts|js|mjs|cjs)$/.test(file.name)) {
        await this.loadModel(filePath);
      }
    }
  }

  /**
   * Checks whether a directory exists.
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      return (await fs.stat(dir)).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Dynamically imports and initializes a Sequelize model.
   *
   * Uses native dynamic import to support applications
   * executed through tsx.
   */
  private async loadModel(filePath: string): Promise<void> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

      const module = await dynamicImport(pathToFileURL(filePath).href);

      const ModelClass = module.default;

      if (!ModelClass || typeof ModelClass.initialize !== 'function') {
        throw new TypeError(`Model at ${filePath} must export a default class with an initialize() method.`);
      }

      await ModelClass.initialize(this.sequelize);

      this.models[ModelClass.name] = ModelClass;
    } catch (error) {
      logger.error(`Failed to load model at ${filePath}`, error);

      throw error;
    }
  }
}
