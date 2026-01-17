import { Markup, TelegramError } from 'telegraf';
import { type InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import { MediaService } from '../bot/media.service';

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';

import { type VerificationContext } from '../types/context.interface';

export interface ButtonData {
  text: string;
  data: string;
}

export interface ViewData {
  text: string;
  image?: string;
  buttons: ButtonData[]; // Массив рядов кнопок
}

@Injectable()
export class VerificationView {
  private readonly logger = new Logger('VerificationView');

  constructor(private readonly mediaService: MediaService) {}

  private buildKeyboard(buttons: ButtonData[]): Markup.Markup<InlineKeyboardMarkup> {
    const buttonRows = buttons.map((desc) => [Markup.button.callback(desc.text, desc.data)]);
    return Markup.inlineKeyboard(buttonRows);
  }

  public async show(ctx: VerificationContext, params: ViewData) {
    const CAPTION_LIMIT = 1024;
    const { text, image, buttons } = params;

    const prevMessage = ctx.callbackQuery?.message;

    const isPhoto = image && text.length <= CAPTION_LIMIT;
    const isPrevPhoto = prevMessage && 'photo' in prevMessage;

    const keyboard = this.buildKeyboard(buttons);
    const sendData = { text, image, keyboard };

    try {
      if (!prevMessage) {
        return await this.sendNew(ctx, sendData);
      }

      if ((isPhoto && isPrevPhoto) || (!isPhoto && !isPrevPhoto)) {
        await this.edit(ctx, sendData);
      } else {
        await ctx.deleteMessage(prevMessage.message_id).catch(() => {});
        await this.sendNew(ctx, sendData);
      }
    } catch (e) {
      const isNotModifiedError =
        e instanceof TelegramError && e.description.includes('message is not modified');

      if (isNotModifiedError) {
        this.logger.info('[VerificationView] Message was not modified, ignoring.');
        await ctx.answerCbQuery().catch(() => {});
      } else {
        this.logger.warn('[VerificationView] smartSend failed, sending new message', e);
        await this.sendNew(ctx, sendData).catch((sendErr) => {
          this.logger.error('[VerificationView] Fallback sendNew also failed', sendErr);
        });
      }
    }
  }

  private async sendNew(
    ctx: VerificationContext,
    params: Omit<ViewData, 'buttons'> & {
      keyboard: Markup.Markup<InlineKeyboardMarkup>;
    },
  ) {
    if (params.image) {
      await this.mediaService.sendPhoto(ctx, params.image, { caption: params.text, reply_markup: params.keyboard.reply_markup });
    } else {
      await ctx.reply(params.text, { parse_mode: 'HTML', ...params.keyboard });
    }
  }

  private async edit(
    ctx: VerificationContext,
    params: Omit<ViewData, 'buttons'> & {
      keyboard: Markup.Markup<InlineKeyboardMarkup>;
    },
  ) {
    if (params.image) {
      await this.mediaService.editPhoto(ctx, params.image, { caption: params.text, reply_markup: params.keyboard.reply_markup });
    } else {
      await ctx.editMessageText(params.text, { parse_mode: 'HTML', ...params.keyboard });
    }
  }
}
