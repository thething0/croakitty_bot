import { BotService } from './bot/bot.service';

import { Container, Injectable } from './utils/DI.container';
import { Logger } from './utils/logger';

import { DatabaseService } from './database/database.service';
import { UserService } from './user/user.service';

@Injectable()
export class App {
  private readonly logger = new Logger('App');

  constructor(
    private readonly botService: BotService,
    private readonly userService: UserService,
    private readonly databaseService: DatabaseService,
  ) {}

  public async init() {
    this.registerShutdownHooks();

    await this.botService.init();

    this.logger.info('Checking for expired attempts on startup...');
    this.userService.checkAndResetAttempts();
    this.runScheduler();

    await this.botService.start();
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

export async function bootstrap() {
  const app = Container.get(App);
  await app.init();
}
