import Database, { type Database as DB, type Statement } from 'better-sqlite3';

export interface UserRecord {
  id: number;
  user_id: number;
  chat_id: number;
  is_muted: boolean;
  attempts: number;
  last_attempt: number | null;
}

type DBUserRecord = Omit<UserRecord, 'is_muted' | 'last_attempt'> & { is_muted: number; last_attempt: number | null };

export class DatabaseService {
  public readonly db: DB;
  private initialized = false;

  private stmts!: {
    findUser: Statement<[number, number]>;
    findUserOnly: Statement<[number]>;
    findAllUserRecords: Statement<[number]>;
    createUser: Statement<[number, number, number]>;
    updateUser: Statement<[number | null, number | null, number | null, number, number]>;
    resetAttempts: Statement;
    resetExpiredAttempts: Statement<[number]>;
    getAllMediaCache: Statement; // для "прогрева"
    setMediaCache: Statement<[string, string]>; // для сохранения
  };

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    // Создаём таблицы и подготавливаем statements сразу
    this.init();
    this.stmts = {
      findUser: this.db.prepare('SELECT * FROM users WHERE user_id = ? AND chat_id = ?'),
      findUserOnly: this.db.prepare('SELECT * FROM users WHERE user_id = ? LIMIT 1'),
      findAllUserRecords: this.db.prepare('SELECT * FROM users WHERE user_id = ?'),
      createUser: this.db.prepare(`
        INSERT INTO users (user_id, chat_id, last_attempt)
        VALUES (?, ?, ?) ON CONFLICT(user_id, chat_id) DO
        UPDATE SET user_id = user_id RETURNING *`),
      updateUser: this.db.prepare(
        'UPDATE users SET is_muted = COALESCE(?, is_muted), attempts = COALESCE(?, attempts), last_attempt = COALESCE(?, last_attempt) WHERE user_id = ? AND chat_id = ?',
      ),
      resetAttempts: this.db.prepare('UPDATE users SET attempts = 0 WHERE attempts > 0'),
      resetExpiredAttempts: this.db.prepare('UPDATE users SET attempts = 0 WHERE attempts > 0 AND last_attempt <= ?'),
      getAllMediaCache: this.db.prepare('SELECT path, file_id FROM media_cache'),
      setMediaCache: this.db.prepare(
        'INSERT INTO media_cache (path, file_id) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET file_id = excluded.file_id',
      ),
    };
  }

  public init(): void {
    if (this.initialized) return;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      //основная таблица
      const initialTableSQL = `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id BIGINT NOT NULL,
          chat_id BIGINT NOT NULL,
          is_muted INTEGER NOT NULL DEFAULT 1 CHECK (is_muted IN (0, 1)),
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt INTEGER,
          UNIQUE ( user_id, chat_id )
          );
        `;
      // Таблицы
      this.db.exec(initialTableSQL);
      //метаданные например время сброса попыток итд
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
      //кеш файлов тг
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS media_cache (
          path TEXT PRIMARY KEY NOT NULL,
          file_id TEXT NOT NULL
        );
      `);

      this.db.exec('COMMIT');
      this.initialized = true;
      console.log('Database initialized successfully.');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  public close(): void {
    this.db.close();
    console.log('Database connection closed.');
  }

  public findUser(userId: number, chatId?: number): UserRecord | undefined {
    let row: DBUserRecord | undefined;
    if (typeof chatId !== 'undefined') {
      row = this.stmts.findUser.get(userId, chatId) as DBUserRecord | undefined;
    } else {
      row = this.stmts.findUserOnly.get(userId) as DBUserRecord | undefined;
    }
    return row ? this._fromDB(row) : undefined;
  }

  public createUser(userId: number, chatId: number): UserRecord {
    const row = this.stmts.createUser.get(userId, chatId, Date.now()) as DBUserRecord;
    if (row) return this._fromDB(row);

    throw new Error(`Unexpected state: user (${userId}, ${chatId}) should exist after INSERT OR IGNORE`);
  }

  public updateUser(userId: number, chatId: number, data: Partial<Pick<UserRecord, 'is_muted' | 'attempts' | 'last_attempt'>>): void {
    const isMutedValue = typeof data.is_muted === 'undefined' ? null : +data.is_muted;
    const attemptsValue = typeof data.attempts === 'undefined' ? null : data.attempts;
    const lastAttempt = typeof data.last_attempt === 'undefined' ? null : data.last_attempt;

    if (isMutedValue === null && attemptsValue === null) {
      return;
    }
    this.stmts.updateUser.run(isMutedValue, attemptsValue, lastAttempt, userId, chatId);
  }

  public resetAllAttempts(): number {
    return this.stmts.resetAttempts.run().changes;
  }

  public resetExpiredAttempts(thresholdTimestamp: number): number {
    return this.stmts.resetExpiredAttempts.run(thresholdTimestamp).changes;
  }

  public getAllMediaCache(): { path: string; file_id: string }[] {
    return this.stmts.getAllMediaCache.all() as { path: string; file_id: string }[];
  }

  public setFileId(path: string, fileId: string): void {
    this.stmts.setMediaCache.run(path, fileId);
  }

  private _fromDB(dbRecord: DBUserRecord): UserRecord {
    return {
      ...dbRecord,
      is_muted: dbRecord.is_muted !== 0,
    };
  }
  public findAllUserRecords(userId: number): UserRecord[] {
    const rows = this.stmts.findAllUserRecords.all(userId) as DBUserRecord[];
    return rows.map((row) => this._fromDB(row));
  }
}
