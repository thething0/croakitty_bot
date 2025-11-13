import { Markup, type Telegraf } from 'telegraf';

import { type MyContext } from '../types/context.interface';
import { type UserService } from '../user/user.service';

export class PrivateHandler {
  constructor(
    private readonly bot: Telegraf<MyContext>,
    private readonly userService: UserService,
  ) {}

  public handleCommands(): void {
    this.bot.start(async (ctx) => {
      if (ctx.chat.type !== 'private') {
        return;
      }

      const chatId = ctx.payload;

      if (chatId && !isNaN(+chatId)) {
        const initialState = {
          chatId: +chatId,
          userId: ctx.from.id,
          currentStep: 0,
          answers: [],
        };
        return ctx.scene.enter('verification', initialState);
      }

      await ctx.reply('Привет! Я бот для проверки новых участников. Добавьте меня в группу, чтобы я мог работать.');
    });

    this.bot.command('restart', async (ctx) => {
      if (ctx.chat.type !== 'private') return;

      const userId = ctx.from.id;
      const userRecords = this.userService.findAllUserRecords(userId);

      if (userRecords.length === 0) {
        return ctx.reply('Я не нашел чатов, в которых вы проходили верификацию. Пожалуйста, начните из группы.');
      }

      if (userRecords.length === 1) {
        const record = userRecords[0];
        /*await ctx.reply(`Перезапускаю верификацию для чата... (ID: ${record.chat_id})`);*/
        return ctx.scene.enter('verification', {
          chatId: record.chat_id,
          userId: userId,
          currentStep: 0,
          answers: [],
        });
      }

      await ctx.reply(
        'Я нашел вас в нескольких чатах. Для какого из них вы хотите перезапустить верификацию?',
        Markup.inlineKeyboard(
          userRecords.map((record) => [
            Markup.button.url(`Чат ID: ${record.chat_id}`, `https://t.me/${ctx.botInfo.username}?start=${record.chat_id}`),
          ]),
        ),
      );
    });

    // фикс обработки вне сцены
    this.bot.on('callback_query', async (ctx) => {
      console.warn(`Caught an orphaned callback query for user ${ctx.from.id}`);
      try {
        await ctx.reply(
          'Ой, кажется, я перезагрузился и забыл, на чем мы остановились. 😵‍💫\nПожалуйста, напишите /restart, чтобы начать проверку заново.',
        );
      } catch (e) {
        console.error('[Failsafe] Could not respond to an orphaned callback query.', e);
      }
    });
  }
}
