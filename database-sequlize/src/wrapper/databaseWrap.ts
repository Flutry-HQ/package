import { CreateOptions, DestroyOptions, FindOptions, Model, ModelStatic, Sequelize, Transaction, UpdateOptions, Utils } from 'sequelize';

/**
 * Common database operations for Sequelize models.
 *
 * The helper methods wrap frequently used Sequelize operations and
 * automatically convert model instances into plain JavaScript objects
 * where applicable.
 */
export class Database {
  /**
   * Finds all records matching the provided options.
   *
   * @param model Sequelize model to query.
   * @param options Optional Sequelize query options.
   * @returns An array of plain JavaScript objects.
   */
  static async findAll<T extends Model>(model: ModelStatic<T>, options?: FindOptions<T['_attributes']>): Promise<object[]> {
    const results = await model.findAll(options);

    return results.map((row) => row.get({ plain: true }));
  }

  /**
   * Finds the first record matching the provided options.
   *
   * @param model Sequelize model to query.
   * @param options Optional Sequelize query options.
   * @returns A plain JavaScript object or `null` when no record is found.
   */
  static async findOne<T extends Model>(model: ModelStatic<T>, options?: FindOptions<T['_attributes']>): Promise<object | null> {
    const result = await model.findOne(options);

    return result ? result.get({ plain: true }) : null;
  }

  /**
   * Finds a record by its primary key.
   *
   * @param model Sequelize model to query.
   * @param identifier Primary key value.
   * @param options Optional Sequelize query options excluding `where`.
   * @returns A plain JavaScript object or `null` when no record is found.
   */
  static async findByPk<T extends Model>(
    model: ModelStatic<T>,
    identifier: string | number,
    options?: Omit<FindOptions<T['_attributes']>, 'where'>,
  ): Promise<object | null> {
    const result = await model.findByPk(identifier, options);

    return result ? result.get({ plain: true }) : null;
  }

  /**
   * Checks whether at least one record matches the provided options.
   *
   * @param model Sequelize model to query.
   * @param options Sequelize query options.
   * @returns `true` when a matching record exists, otherwise `false`.
   */
  static async exists<T extends Model>(model: ModelStatic<T>, options: FindOptions<T['_attributes']>): Promise<boolean> {
    return (
      (await model.findOne({
        ...options,
        attributes: ['*'],
      })) !== null
    );
  }

  /**
   * Creates a new record.
   *
   * @param model Sequelize model to use.
   * @param values Values used to create the record.
   * @param options Optional Sequelize creation options.
   * @returns The created record as a plain JavaScript object.
   */
  static async create<T extends Model>(
    model: ModelStatic<T>,
    values: Utils.MakeNullishOptional<T['_creationAttributes']>,
    options?: CreateOptions<T['_creationAttributes']>,
  ): Promise<object> {
    const result = await model.create(values, options);

    return result.get({ plain: true });
  }

  /**
   * Updates records matching the provided options.
   *
   * @param model Sequelize model to update.
   * @param values Values to update.
   * @param options Sequelize update options.
   * @returns The updated records as plain JavaScript objects.
   */
  static async update<T extends Model>(
    model: ModelStatic<T>,
    values: Partial<T['_creationAttributes']>,
    options: UpdateOptions<T['_creationAttributes']>,
  ): Promise<object[]> {
    const result = await model.update(values, {
      ...options,
      returning: true,
    });

    if (Array.isArray(result)) {
      const [_count, updatedRows] = result;

      if (Array.isArray(updatedRows)) {
        return updatedRows.map((row) => row.get({ plain: true }));
      }
    }

    return [];
  }

  /**
   * Deletes records matching the provided options.
   *
   * @param model Sequelize model to delete from.
   * @param options Sequelize destroy options.
   * @returns The number of deleted records.
   */
  static async destroy<T extends Model>(model: ModelStatic<T>, options: DestroyOptions<T['_creationAttributes']>): Promise<number> {
    return model.destroy(options);
  }

  /**
   * Counts records matching the provided options.
   *
   * @param model Sequelize model to query.
   * @param options Optional Sequelize query options.
   * @returns The number of matching records.
   */
  static async count<T extends Model>(model: ModelStatic<T>, options?: FindOptions): Promise<number> {
    return model.count(options);
  }

  /**
   * Executes operations inside a Sequelize transaction.
   *
   * The transaction is automatically committed when the callback
   * completes successfully and rolled back when it throws an error.
   *
   * @param sequelize Sequelize instance used for the transaction.
   * @param callback Function containing the transactional operations.
   * @returns The value returned by the transaction callback.
   */
  static async transaction<T>(sequelize: Sequelize, callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    return sequelize.transaction(callback);
  }
}

/**
 * Functional exports for common database operations.
 *
 * These exports allow database helpers to be used directly without
 * accessing the `Database` class.
 *
 * @example
 * ```ts
 * import { findOne, create } from '@flutry/database-sequelize';
 * ```
 */
export const { findOne, findAll, findByPk, exists, create, update, destroy, count, transaction } = Database;
