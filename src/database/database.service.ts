import Database, { type Database as DB } from 'better-sqlite3';

import { ConfigService } from '../config/config.service'; // <--- Добавили

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';

export interface UserRecord {
  id: number;
  user_id: number;
  chat_id: number;
  is_muted: boolean;
  attempts: number;
  last_attempt: number | null;
}

@Injectable()
export class DatabaseService {
  public readonly db: DB;
  private readonly logger = new Logger('DatabaseService');

  constructor(private readonly configService: ConfigService) {
    const databasePath = this.configService.get('DB_PATH');
    this.db = new Database(databasePath);
    this.init();
  }

  public init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id BIGINT NOT NULL,
       chat_id BIGINT NOT NULL,
       is_muted INTEGER DEFAULT 1,
       attempts INTEGER DEFAULT 0,
       last_attempt INTEGER,
       UNIQUE (user_id, chat_id)
      );
      CREATE TABLE IF NOT EXISTS media_cache (
       path TEXT PRIMARY KEY NOT NULL,
       file_id TEXT NOT NULL
      );
    `);
    this.logger.info('Database initialized.');
  }

  public close(): void {
    this.db.close();
    this.logger.info('Database connection closed.');
  }

  public findUser(userId: number, chatId: number): UserRecord {
    const stmt = this.db.prepare('SELECT *, is_muted != 0 as is_muted FROM users WHERE user_id = ? AND chat_id = ?');
    return stmt.get(userId, chatId) as UserRecord;
  }

  public findAllUserRecords(userId: number): UserRecord[] {
    const stmt = this.db.prepare('SELECT *, is_muted != 0 as is_muted FROM users WHERE user_id = ?');
    return stmt.all(userId) as UserRecord[];
  }

  public createUser(userId: number, chatId: number): void {
    this.db.prepare('INSERT OR IGNORE INTO users (user_id, chat_id) VALUES (?, ?)').run(userId, chatId);
  }

  public updateUser(userId: number, chatId: number, data: Partial<Pick<UserRecord, 'is_muted' | 'attempts' | 'last_attempt'>>): void {
    const fields: string[] = [];
    const values: (number | null)[] = [];

    if (data.is_muted !== undefined) {
      fields.push('is_muted = ?');
      values.push(+data.is_muted); // Короткий плюс для приведения true/false к 1/0
    }
    if (data.attempts !== undefined) {
      fields.push('attempts = ?');
      values.push(data.attempts);
    }
    if (data.last_attempt !== undefined) {
      fields.push('last_attempt = ?');
      values.push(data.last_attempt);
    }

    if (fields.length === 0) return;

    this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ? AND chat_id = ?`).run(...values, userId, chatId);
  }

  public resetExpiredAttempts(thresholdTimestamp: number): number {
    const stmt = this.db.prepare('UPDATE users SET attempts = 0 WHERE attempts > 0 AND last_attempt <= ?');
    return stmt.run(thresholdTimestamp).changes;
  }

  //кеш медиафайлов

  public getAllMediaCache(): { path: string; file_id: string }[] {
    return this.db.prepare('SELECT path, file_id FROM media_cache').all() as { path: string; file_id: string }[];
  }

  public setFileId(path: string, fileId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO media_cache (path, file_id) VALUES (?, ?)').run(path, fileId);
  }
}
