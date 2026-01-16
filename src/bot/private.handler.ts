import { Markup, type Telegraf } from 'telegraf';

import { type VerificationContext } from '../types/context.interface';
import { UserService } from '../user/user.service';

export class PrivateHandler {
  constructor(
    private readonly userService: UserService,
  ) {}

  public handle(bot: Telegraf<VerificationContext>): void {
    bot.start(async (ctx) => {
      if (ctx.chat.type !== 'private') {
        return;
      }

      const chatId = +ctx.payload;
      if (chatId && !isNaN(+chatId)) {
        return this.enterVerification(ctx, chatId);
      }

      await ctx.reply('Привет! Я бот для проверки новых участников. Добавьте меня в группу, чтобы я мог работать.');
      //возможно если будет логика добавления бота и настройки итд тут надо добавить ее, но пока это чисто на один чат
    });

    // /restart для отладки
    bot.command('restart', async (ctx) => {
      if (ctx.chat.type !== 'private') return;
      await this.runVerification(ctx);
    });

    // перезапуск с клавиатуры
    bot.action(/restart_verification:(-?\d+)/, async (ctx) => {
      await ctx.answerCbQuery();
      return this.runVerification(ctx, +ctx.match[1]);
    });

    // фикс обработки вне сцены
    bot.on('callback_query', async (ctx) => {
      console.warn(`[PrivateHandler] Caught unknown callback from user ${ctx.from.id}`);
      try {
        await ctx.answerCbQuery();
        await ctx.reply(
          'Ой, кажется, я перезагрузился и забыл, на чем мы остановились.\nНажми на кнопку ниже, чтобы начать проверку заново.',
          Markup.inlineKeyboard([
            Markup.button.callback('Тык', 'restart_verification:0')
          ])
        );
      } catch (e) {
        console.error(`[PrivateHandler] Failed to send restart message to user ${ctx.from.id}`, e);
      }
    });
  }

  private async runVerification(ctx: VerificationContext, chatId?: number) {
    const userId = ctx.from!.id;

    if (!chatId) {
      const userRecords = this.userService.findAllUserRecords(userId);

      if (userRecords.length === 0) {
        return ctx.reply('Я не нашел чатов, в которых вы проходили верификацию. Пожалуйста, начните из группы.');
      } else if (userRecords.length === 1) {
        chatId = userRecords[0].chat_id;
      } else {
        //не факт что будет, т.к. пока чат один и масштабирования нет, но на случай ошибок пусть остается
        return ctx.reply(
          'Я нашел вас в нескольких чатах. Где перезапустить проверку?',
          Markup.inlineKeyboard(
            userRecords.map((r) => [Markup.button.callback(`Чат ID: ${r.chat_id}`, `restart_verification:${r.chat_id}`)]),
          ),
        );
      }
    }

    return await this.enterVerification(ctx, chatId);
  }

  private async enterVerification(ctx: VerificationContext, chatId: number) {
    const initialState = {
      chatId,
      userId: ctx.from!.id,
      currentStep: 0,
      answers: [],
    };
    return ctx.scene.enter('rules', initialState);
  }
}
