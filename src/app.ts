import { type IConfigService } from './config/config.interface';
import { ConfigService } from './config/config.service';

import { BotService } from './bot/bot.service';
import { MediaService } from './bot/media.service';

import { CacheService } from './cache/cache.service';
import { DatabaseService } from './database/database.service';
import { QuestionsScene } from './scenes/questions.scene';
import { RulesScene } from './scenes/rules.scene';
import { UserService } from './user/user.service';
import { VerificationContentService } from './verification/verification.service';
import { VerificationView } from './verification/verification.view';

export class App {
  private readonly configService: IConfigService;
  private readonly databaseService: DatabaseService;
  private readonly cacheService: CacheService;
  private readonly mediaService: MediaService;
  private readonly userService: UserService;
  private readonly verificationContentService: VerificationContentService;
  private readonly verificationView: VerificationView;
  private readonly questionsScene: QuestionsScene;
  private readonly rulesScene: RulesScene;
  private readonly botService: BotService;

  constructor() {
    this.configService = new ConfigService();

    const dbPath = this.configService.get('DB_PATH');
    this.databaseService = new DatabaseService(dbPath);
    this.cacheService = new CacheService(this.databaseService);
    this.mediaService = new MediaService(this.cacheService, this.configService);

    this.userService = new UserService(this.databaseService, this.configService);
    this.verificationContentService = new VerificationContentService(this.configService);

    this.verificationView = new VerificationView(this.mediaService);

    this.rulesScene = new RulesScene(this.verificationContentService, this.verificationView);
    this.questionsScene = new QuestionsScene(
      this.configService,
      this.userService,
      this.verificationContentService,
      this.verificationView,
    );

    this.botService = new BotService(
      this.configService,
      this.databaseService,
      this.userService,
      this.rulesScene,
      this.questionsScene,
    );
  }

  public async init() {
    await this.botService.init();

    console.log('Checking for expired attempts on startup...');
    this.userService.checkAndResetAttempts();
    this.runScheduler();

    await this.botService.start();

    this.registerShutdownHooks();
  }

  private runScheduler() {
    const CHECK_INTERVAL_MS = 5 * 60 * 1000; //раз в 5 минут

    setTimeout(() => {
      this.userService.checkAndResetAttempts();
      this.runScheduler();
    }, CHECK_INTERVAL_MS);
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
