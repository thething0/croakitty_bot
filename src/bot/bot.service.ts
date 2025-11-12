import { SQLite } from '@telegraf/session/sqlite';
import { Scenes, session, Telegraf } from 'telegraf';
import { type Telegram } from 'telegraf/types';
import type { ExtraRestrictChatMember } from 'telegraf/typings/telegram-types';

import { type IConfigService } from '../config/config.interface';

import { type DatabaseService } from '../database/database.service';
import { type VerificationSceneService } from '../scenes/verification.scene.service';
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
    private readonly verificationSceneService: VerificationSceneService,
    private readonly userService: UserService,
  ) {
    this.bot = new Telegraf<MyContext>(this.configService.get('BOT_TOKEN'));
  }

  public async init(): Promise<void> {
    const verificationScene = this.verificationSceneService.createScene();
    const stage = new Scenes.Stage<MyContext>([verificationScene]);

    const store = SQLite<MyWizardSession>({
      database: this.dbService.db,
    });

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
    this.botInfo = await this.bot.telegram.getMe();

    this.registerHandlers();
    console.log('✅ Bot service configured. Launching...');
    await this.bot.launch(async () => {
      console.log('✅ Bot service initialized and bot launched.');
    });
  }

  private registerHandlers(): void {
    const privateHandler = new PrivateHandler(this.bot, this.userService);
    const groupHandler = new GroupHandler(this.bot, this.userService, this.botInfo);

    privateHandler.handleCommands();
    groupHandler.handleEvents();
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
