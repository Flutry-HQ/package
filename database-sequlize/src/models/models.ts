import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { Connect } from '../connect/connect';
import { logger } from '@flutry/common';

/**
 * Automatically discovers, initializes, and synchronizes
 * Sequelize models used by the application.
 *
 * Models are loaded from the application's `src/models` directory
 * during development and from `dist/models` in production builds.
 *
 * Model files must follow the `.model` naming convention and expose
 * a default class with a static `initialize()` method.
 */
export default class Models {
  /** Collection of all discovered Sequelize models. */
  private models: Record<string, any> = {};

  /**
   * Initializes the model loader.
   */
  constructor() {}

  /**
   * Determines whether the application is running in development mode.
   */
  private isDevelopment = (): boolean => process.env.NODE_ENV !== 'production';

  /**
   * Loads all application models, configures their associations,
   * and synchronizes the database schema.
   *
   * Models are loaded before associations are configured to ensure
   * that every model is available when associations are created.
   *
   * In development mode, Sequelize uses `alter: true` to automatically
   * update the database schema. Production uses a normal synchronization.
   */
  public async init(): Promise<void> {
    const sourceDir = path.join(process.cwd(), 'src/models');
    const buildDir = path.join(process.cwd(), 'dist/models');

    // Prefer source models when running in development.
    const modelsDir = (await this.directoryExists(sourceDir)) ? sourceDir : buildDir;

    // Load every model before configuring associations.
    await this.initModels(modelsDir);

    // Configure associations after all models have been loaded.
    for (const modelName of Object.keys(this.models)) {
      const model = this.models[modelName];

      if (typeof model.associate === 'function') {
        model.associate(this.models);
      }
    }

    try {
      // Use alter synchronization during development.
      if (this.isDevelopment()) {
        await Connect.sequelize.sync({ alter: true });
      } else {
        await Connect.sequelize.sync();
      }

      logger.info('All models were synchronized successfully.');
    } catch (error) {
      logger.error('Unable to synchronize models:', error);
      throw error;
    }
  }

  /**
   * Recursively searches a directory for Sequelize model files.
   *
   * Supported file extensions:
   * - `.ts`
   * - `.js`
   * - `.mjs`
   * - `.cjs`
   *
   * @param dir Directory to search.
   */
  private async initModels(dir: string): Promise<void> {
    const files = await fs.readdir(dir, {
      withFileTypes: true,
    });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await this.initModels(filePath);
      } else if (/\.model\.(ts|js|mjs|cjs)$/.test(file.name)) {
        await this.loadModel(filePath);
      }
    }
  }

  /**
   * Checks whether a directory exists.
   *
   * @param dir Directory path to check.
   * @returns `true` when the directory exists and is a directory.
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
   * The model must expose a default export containing a static
   * `initialize()` method.
   *
   * @param filePath Absolute path to the model file.
   */
  private loadModel = async (filePath: string): Promise<void> => {
    try {
      const module = await import(pathToFileURL(filePath).href);

      const ModelClass = module.default;

      if (ModelClass && typeof ModelClass.initialize === 'function') {
        ModelClass.initialize(Connect.sequelize);

        this.models[ModelClass.name] = ModelClass;
      } else {
        logger.info(`Model at ${filePath} does not have an initialize method.`);
      }
    } catch (error) {
      logger.error(`Failed to load model at ${filePath}`, error);
    }
  };
}
