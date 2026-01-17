import { Markup, type Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { type Telegram } from 'telegraf/types';
import { type User } from 'telegraf/typings/core/types/typegram';

import { BotService } from './bot.service';

import { Logger } from '../utils/logger';

import { type VerificationContext } from '../types/context.interface';
import { UserService } from '../user/user.service';
import { escapeHTML } from '../utils/text.utils';

export class GroupHandler {
  private readonly logger = new Logger('GroupHandler');

  constructor(private readonly userService: UserService) {}

  public handle(bot: Telegraf<VerificationContext>, botInfo: ReturnType<Telegram['getMe']>): void {
    // Обработка входа нового участника, может не работать, проверить
    bot.on(message('new_chat_members'), async (ctx) => {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return;
      }

      for (const member of ctx.message.new_chat_members) {
        if (member.is_bot) continue;

        const userLog = `${member.id} (${member.first_name} @${member.username || 'no_username'})`;
        const chatLog = `${ctx.chat.id} (${ctx.chat.title})`;
        this.logger.info(`New member joined: ${userLog} in chat ${chatLog}.`);

        try {
          //проверяем не админ ли
          const chatMember = await ctx.getChatMember(member.id);
          const isAdmin = ['creator', 'administrator'].includes(chatMember.status);
          if (isAdmin) {
            this.logger.warn(`User ${userLog} is an admin. Skipping mute.`);
            continue;
          }

          // проверка на реджойн
          const existingUser = this.userService.findUser(member.id, ctx.chat.id);
          if (existingUser && !existingUser?.is_muted) {
            this.logger.info(`User ${userLog} already verified (re-joined). Skipping mute.`);
            continue;
          }

          this.logger.info(`Applying mute to user ${userLog} in chat ${chatLog}.`);
          await ctx.telegram.restrictChatMember(ctx.chat.id, member.id, {
            permissions: BotService.mutePermissions,
          });
          this.userService.handleNewMemberJoined(member.id, ctx.chat.id);

          const { text, extra } = this.createWelcomeMessage(botInfo.username, ctx.chat.id, member);
          await ctx.reply(text, extra);
        } catch (e) {
          this.logger.error(`Failed to process new member ${userLog} in chat ${chatLog}.`, e);
        }
      }
    });

    // Тестовая команда для отладки
    bot.command('test', async (ctx) => {
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return;
      }
      const { text, extra } = this.createWelcomeMessage(botInfo.username, ctx.chat.id, ctx.from);
      await ctx.reply(text, extra);
    });
  }

  private createWelcomeMessage(botUsername: string, chatId: number, user: User) {
    const botLink = `https://t.me/${botUsername}?start=${chatId}`;
    const keyboard = Markup.inlineKeyboard([Markup.button.url('Тык сюда', botLink)]);

    const userName = user.username || user.first_name || 'Безымянный пользователь';
    const userMention = `<a href="tg://user?id=${user.id}">${escapeHTML(userName)}</a>`;

    const text = `Привет, ${userMention}! Это Кватёныш, бот этого чата.\nЯ здесь, чтобы сориентировать тебя в правилах чата перед твоим участием в нем.\nПожалуйста, перейди в меня по кнопке ниже.`;

    const extra = {
      ...keyboard,
      parse_mode: 'HTML' as const,
    };

    return { text, extra };
  }
}
