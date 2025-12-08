import path from 'node:path';
import { type InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import { type IConfigService } from '../config/config.interface';

import { type CacheService } from '../cache/cache.service';
import { type VerificationContext } from '../types/context.interface';

export class MediaService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: IConfigService,
  ) {}

  public async sendPhoto(
    ctx: VerificationContext,
    imagePath: string,
    options: { caption: string; reply_markup: InlineKeyboardMarkup },
  ): Promise<void> {
    const imageFullPath = path.join(/*process.cwd(),*/ this.configService.get('MEDIA_PATH', './media'), imagePath);
    const fileId = this.cacheService.getFileId(imageFullPath) as string | undefined;

    if (fileId) {
      // Если file_id есть, используем его (он имеет тип string)
      await ctx.replyWithPhoto(fileId, {
        caption: options.caption,
        parse_mode: 'HTML',
        reply_markup: options.reply_markup,
      });
    } else {
      // Если file_id нет, используем объект { source: ... }
      const sentMessage = await ctx.replyWithPhoto(
        { source: imageFullPath },
        {
          caption: options.caption,
          parse_mode: 'HTML',
          reply_markup: options.reply_markup,
        },
      );

      // Кешируем file_id только в том случае, если мы действительно загружали файл
      if (sentMessage.photo) {
        const newFileId = sentMessage.photo.pop()?.file_id;
        if (newFileId) {
          this.cacheService.setFileId(imageFullPath, newFileId);
          console.log(`[Cache] Cached new file_id for ${imageFullPath}`);
        }
      }
    }
  }

  public async editPhoto(
    ctx: VerificationContext,
    imagePath: string,
    options: { caption: string; reply_markup: InlineKeyboardMarkup },
  ): Promise<void> {
    const imageFullPath = path.join(this.configService.get('MEDIA_PATH', './media'), imagePath);
    const fileId = this.cacheService.getFileId(imageFullPath) as string | undefined;

    if (!fileId || !ctx.callbackQuery?.message) {
      if (ctx.callbackQuery?.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      await this.sendPhoto(ctx, imageFullPath, options);
      return;
    }

    await ctx.editMessageMedia(
      { type: 'photo', media: fileId, caption: options.caption, parse_mode: 'HTML' },
      { reply_markup: options.reply_markup },
    );
  }
}
