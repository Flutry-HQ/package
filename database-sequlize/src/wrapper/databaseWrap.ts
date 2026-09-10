import { CreateOptions, DestroyOptions, FindOptions, Model, ModelStatic, Sequelize, Transaction, UpdateOptions, Utils } from 'sequelize';

/**
 * @deprecated
 * This database wrapper is deprecated and will be removed in a future version.
 *
 * Use the native Sequelize Model API directly instead.
 *
 * @see https://sequelize.org/docs/v6/core-concepts/model-basics/
 *
 * Example:
 * ```ts
 * const users = await User.findAll();
 * ```
 */
export class Database {
  /**
   * Finds all records matching the provided options.
   *
   * @deprecated Use the native Sequelize `Model.findAll()` method instead.
   *
   * @example
   * ```ts
   * const users = await User.findAll({
   *   where: {
   *     active: true,
   *   },
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
   */
  static async findAll<T extends Model>(model: ModelStatic<T>, options?: FindOptions<T['_attributes']>): Promise<object[]> {
    const results = await model.findAll(options);

    return results.map((row) => row.get({ plain: true }));
  }

  /**
   * Finds the first record matching the provided options.
   *
   * @deprecated Use the native Sequelize `Model.findOne()` method instead.
   *
   * @example
   * ```ts
   * const user = await User.findOne({
   *   where: {
   *     id: userId,
   *   },
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-finders/
   */
  static async findOne<T extends Model>(model: ModelStatic<T>, options?: FindOptions<T['_attributes']>): Promise<object | null> {
    const result = await model.findOne(options);

    return result ? result.get({ plain: true }) : null;
  }

  /**
   * Finds a record by its primary key.
   *
   * @deprecated Use the native Sequelize `Model.findByPk()` method instead.
   *
   * @example
   * ```ts
   * const user = await User.findByPk(userId);
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-finders/
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
   * @deprecated Use the native Sequelize `Model.findOne()` method instead.
   *
   * @example
   * ```ts
   * const user = await User.findOne({
   *   where: {
   *     email: 'test@example.com',
   *   },
   * });
   *
   * const exists = user !== null;
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-finders/
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
   * @deprecated Use the native Sequelize `Model.create()` method instead.
   *
   * @example
   * ```ts
   * const user = await User.create({
   *   username: 'example',
   *   email: 'test@example.com',
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
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
   * @deprecated Use the native Sequelize `Model.update()` method instead.
   *
   * @example
   * ```ts
   * await User.update(
   *   {
   *     active: false,
   *   },
   *   {
   *     where: {
   *       id: userId,
   *     },
   *   },
   * );
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
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
   * @deprecated Use the native Sequelize `Model.destroy()` method instead.
   *
   * @example
   * ```ts
   * await User.destroy({
   *   where: {
   *     id: userId,
   *   },
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
   */
  static async destroy<T extends Model>(model: ModelStatic<T>, options: DestroyOptions<T['_creationAttributes']>): Promise<number> {
    return model.destroy(options);
  }

  /**
   * Counts records matching the provided options.
   *
   * @deprecated Use the native Sequelize `Model.count()` method instead.
   *
   * @example
   * ```ts
   * const count = await User.count({
   *   where: {
   *     active: true,
   *   },
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
   */
  static async count<T extends Model>(model: ModelStatic<T>, options?: FindOptions): Promise<number> {
    return model.count(options);
  }

  /**
   * Executes operations inside a Sequelize transaction.
   *
   * @deprecated Use the native Sequelize transaction API instead.
   *
   * @example
   * ```ts
   * await sequelize.transaction(async (transaction) => {
   *   await User.create(
   *     {
   *       username: 'example',
   *     },
   *     {
   *       transaction,
   *     },
   *   );
   * });
   * ```
   *
   * @see https://sequelize.org/docs/v6/other-topics/transactions/
   */
  static async transaction<T>(sequelize: Sequelize, callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    return sequelize.transaction(callback);
  }
}

/**
 * @deprecated
 * These helpers are deprecated and will be removed in a future version.
 * Use the native Sequelize Model API directly instead.
 *
 * @see https://sequelize.org/docs/v6/core-concepts/model-basics/
 */
export const { findOne, findAll, findByPk, exists, create, update, destroy, count, transaction } = Database;
