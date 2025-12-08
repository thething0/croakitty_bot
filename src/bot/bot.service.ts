import { SQLite } from '@telegraf/session/sqlite';
import { Scenes, session, Telegraf } from 'telegraf';
import { type Telegram } from 'telegraf/types';
import type { ExtraRestrictChatMember } from 'telegraf/typings/telegram-types';

import { type IConfigService } from '../config/config.interface';

import { type DatabaseService } from '../database/database.service';
import { type QuestionsScene } from '../scenes/questions.scene';
import { type RulesScene } from '../scenes/rules.scene';
import { type MyContext, type MyWizardSession } from '../types/context.interface';
import { type UserService } from '../user/user.service';

import { GroupHandler } from './group.handler';
import { PrivateHandler } from './private.handler';

export class BotService {
  public readonly bot: Telegraf<MyContext>;
  private botInfo!: ReturnType<Telegram['getMe']>;

  constructor(
    private readonly configService: IConfigService,
    private readonly dbService: DatabaseService,
    private readonly userService: UserService,
    // мб стоит потом перенести внутрь
    private readonly rulesScene: RulesScene,
    private readonly questionsScene: QuestionsScene,
  ) {
    this.bot = new Telegraf<MyContext>(this.configService.get('BOT_TOKEN'));
  }

  public async init(): Promise<void> {
    const stage = new Scenes.Stage<MyContext>([this.rulesScene.create(), this.questionsScene.create()]);

    const store = SQLite<MyWizardSession>({
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

    console.log('[BotService] Bot service configured.');
    /*await this.bot.launch(async () => {
      console.log('✅ Bot service initialized and bot launched.');
    });*/
  }

  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.bot
        .launch(() => {
          console.log('[BotService] Bot service initialized and bot launched.');
          resolve();
        })
        .catch((err) => {
          console.error('[BotService] Failed to launch bot:', err);
          reject(err);
        });
    });
  }

  private registerHandlers(): void {
    const privateHandler = new PrivateHandler(this.bot, this.userService);
    const groupHandler = new GroupHandler(this.bot, this.userService, this.botInfo);

    privateHandler.handle();
    groupHandler.handle();
  }

  public stop(signal: string): void {
    this.bot.stop(signal);
    console.log(`⏹️ Bot stopped due to ${signal} signal.`);
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
