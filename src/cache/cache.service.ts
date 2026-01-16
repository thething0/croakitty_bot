import { Injectable } from '../utils/DI.container';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class CacheService {
  private readonly cache = new Map<string, unknown>();
  constructor(private readonly dbService: DatabaseService) {}

  public getFileId(path: string): unknown {
    return this.cache.get(path);
  }

  public setFileId(path: string, fileId: string): void {
    this.cache.set(path, fileId);
    this.dbService.setFileId(path, fileId); // Сразу пишем и в БД
  }
}
