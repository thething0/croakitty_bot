import { Markup, type Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { type Telegram } from 'telegraf/types';
import { type User } from 'telegraf/typings/core/types/typegram';

import { BotService } from './bot.service';

import { type MyContext } from '../types/context.interface';
import { type UserService } from '../user/user.service';

export class GroupHandler {
  constructor(
    private readonly bot: Telegraf<MyContext>,
    private readonly userService: UserService,
    private readonly botInfo: ReturnType<Telegram['getMe']>,
  ) {}

  public handle(): void {
    // Обработка входа нового участника, может не работать, проверить
    this.bot.on(message('new_chat_members'), async (ctx) => {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return;
      }

      for (const member of ctx.message.new_chat_members) {
        if (member.is_bot) continue;
        try {
          await ctx.telegram.restrictChatMember(ctx.chat.id, member.id, {
            permissions: BotService.mutePermissions,
          });
          console.log('NEW MEMBER JOINED! ', member);
          console.log('TO THE CHAT', ctx.chat);

          this.userService.handleNewMemberJoined(member.id, ctx.chat.id);

          const { text, extra } = this.createWelcomeMessage(this.botInfo.username, ctx.chat.id, member);
          await ctx.reply(text, extra);
        } catch (e) {
          console.error(`[GroupHandler] Failed to process new member ${member.id} in chat ${ctx.chat.id}.`, e);
        }
      }
    });

    // Тестовая команда для отладки
    this.bot.command('test', async (ctx) => {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return;
      }
      const { text, extra } = this.createWelcomeMessage(this.botInfo.username, ctx.chat.id, ctx.from);
      await ctx.reply(text, extra);
    });
  }

  private createWelcomeMessage(botUsername: string, chatId: number, user: User) {
    const botLink = `https://t.me/${botUsername}?start=${chatId}`;
    const keyboard = Markup.inlineKeyboard([Markup.button.url('Тык сюда', botLink)]);

    const userName = user.username ?? user.first_name ?? 'Безымянный пользователь';
    const userMention = `<a href="tg://user?id=${user.id}">${userName}</a>`;

    const text = `Привет, ${userMention}! Это Кватёныш, бот этого чата.\nЯ здесь, чтобы сориентировать тебя в правилах чата перед твоим участием в нем.\nПожалуйста, перейди в меня по кнопке ниже.`;

    const extra = {
      ...keyboard,
      parse_mode: 'HTML' as const,
    };

    return { text, extra };
  }
}
