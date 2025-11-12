import { type IConfigService } from './config/config.interface';
import { ConfigService } from './config/config.service';

import { BotService } from './bot/bot.service';
import { MediaService } from './bot/media.service';

import { CacheService } from './cache/cache.service';
import { DatabaseService } from './database/database.service';
import { VerificationSceneService } from './scenes/verification.scene.service';
import { UserService } from './user/user.service';
import { type IVerificationContentService } from './verification/verification.interface';
import { VerificationContentService } from './verification/verification.service';

export class App {
  private readonly configService: IConfigService;
  private readonly databaseService: DatabaseService;
  private readonly cacheService: CacheService;
  private readonly mediaService: MediaService;
  private readonly userService: UserService;
  private readonly verificationContentService: IVerificationContentService;
  private readonly verificationSceneService: VerificationSceneService;
  private readonly botService: BotService;

  constructor() {
    this.configService = new ConfigService();

    const dbPath = this.configService.get('DATABASE_URL');
    this.databaseService = new DatabaseService(dbPath);
    this.cacheService = new CacheService(this.databaseService);
    this.mediaService = new MediaService(this.cacheService);

    this.userService = new UserService(this.databaseService);
    this.verificationContentService = new VerificationContentService();
    this.verificationSceneService = new VerificationSceneService(this.userService, this.verificationContentService, this.mediaService);

    this.botService = new BotService(
      this.configService,
      this.databaseService,
      this.verificationSceneService,
      this.userService,
    );
  }

  public async init() {
    /*this.databaseService.init();*/
    await this.botService.init();

    this.registerShutdownHooks();
  }

  private registerShutdownHooks(): void {
    process.once('SIGINT', () => this.stop('SIGINT'));
    process.once('SIGTERM', () => this.stop('SIGTERM'));
  }

  private stop(signal: string) {
    this.botService.stop(signal);
    this.databaseService.close();
  }
}
