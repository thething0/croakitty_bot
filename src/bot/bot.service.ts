import { SQLite } from '@telegraf/session/sqlite';
import { Scenes, session, Telegraf } from 'telegraf';
import { type Telegram } from 'telegraf/types';
import type { ExtraRestrictChatMember } from 'telegraf/typings/telegram-types';

import { ConfigService } from '../config/config.service';

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';

import { DatabaseService } from '../database/database.service';
import { QuestionsScene } from '../scenes/questions.scene';
import { RulesScene } from '../scenes/rules.scene';
import { VerificationContext, type VerificationSession } from '../types/context.interface';

import { GroupHandler } from './group.handler';
import { PrivateHandler } from './private.handler';

@Injectable()
export class BotService {
  public readonly bot: Telegraf<VerificationContext>;
  private botInfo!: ReturnType<Telegram['getMe']>;

  private readonly logger = new Logger('BotService');

  constructor(
    private readonly configService: ConfigService, // Класс
    private readonly dbService: DatabaseService,
    private readonly rulesScene: RulesScene,
    private readonly questionsScene: QuestionsScene,

    private readonly groupHandler: GroupHandler,
    private readonly privateHandler: PrivateHandler,
  ) {
    this.bot = new Telegraf<VerificationContext>(this.configService.get('BOT_TOKEN'));
  }

  public async init(): Promise<void> {
    const stage = new Scenes.Stage<VerificationContext>([this.rulesScene.create(), this.questionsScene.create()]);

    const store = SQLite<VerificationSession>({
      database: this.dbService.db,
    });

    this.botInfo = await this.bot.telegram.getMe();

    this.bot.use(
      session({
        store,
        getSessionKey: (ctx) => {
          if (ctx.chat?.type === 'private' && ctx.from?.id) {
            return `${ctx.from.id}:${ctx.chat.id}`;
          }
          return undefined;
        },
      }),
    );
    this.bot.use(stage.middleware());

    this.registerHandlers();

    this.logger.info('Bot service configured.');
  }

  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.bot
        .launch(() => {
          this.logger.info(`Bot @${this.botInfo.username} launched successfully.`);
          resolve();
        })
        .catch((err) => {
          this.logger.error('Failed to launch bot:', err);
          reject(err);
        });
    });
  }

  private registerHandlers(): void {
    this.privateHandler.handle(this.bot);
    this.groupHandler.handle(this.bot, this.botInfo);
  }

  public stop(signal: string): void {
    this.bot.stop(signal);
    this.logger.warn(`Bot stopped due to ${signal} signal.`);
  }

  private static _mutePermissions: ExtraRestrictChatMember['permissions'] = {
    can_send_messages: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_audios: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_documents: false,
    can_send_other_messages: false,
  };
  public static get mutePermissions() {
    return this._mutePermissions;
  }
  public static get unmutePermissions() {
    const unmutePermissions = {} as ExtraRestrictChatMember['permissions'];

    // Проходим по всем ключам в permissions и устанавливаем их в true
    for (const key in this._mutePermissions) {
      if (Object.prototype.hasOwnProperty.call(this._mutePermissions, key)) {
        unmutePermissions[key as keyof ExtraRestrictChatMember['permissions']] = true;
      }
    }
    return unmutePermissions;
  }
}
