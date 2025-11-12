import { type DatabaseService } from '../database/database.service';

export class CacheService {
  private readonly cache = new Map<string, unknown>();
  constructor(private readonly dbService: DatabaseService) {}

  public warmUpMediaCache(): void {
    const allMedia = this.dbService.getAllMediaCache();
    for (const medium of allMedia) {
      this.cache.set(medium.path, medium.file_id);
    }
    console.log(`[Cache] Warmed up with ${allMedia.length} media items.`);
  }

  public getFileId(path: string): unknown {
    return this.cache.get(path);
  }

  public setFileId(path: string, fileId: string): void {
    this.cache.set(path, fileId);
    this.dbService.setFileId(path, fileId); // Сразу пишем и в БД
  }
}
