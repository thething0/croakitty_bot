import { Injectable } from '../utils/DI.container';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class CacheService {
  private readonly cache = new Map<string, unknown>();
  constructor(private readonly dbService: DatabaseService) {
    this.loadFromDB()
  }

  public getFileId(path: string): unknown {
    return this.cache.get(path);
  }

  public setFileId(path: string, fileId: string): void {
    this.cache.set(path, fileId);
    this.dbService.setFileId(path, fileId); // Сразу пишем и в БД
  }

  private loadFromDB(): void {
    const records = this.dbService.getAllMediaCache();
    for (const { path, file_id } of records) {
      this.cache.set(path, file_id);
    }
  }
}
