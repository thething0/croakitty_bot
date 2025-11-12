import { type InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import { type CacheService } from '../cache/cache.service';
import { type MyContext } from '../types/context.interface';

export class MediaService {
  constructor(private readonly cacheService: CacheService) {}

  public async sendPhoto(ctx: MyContext, imagePath: string, options: { caption: string; reply_markup: InlineKeyboardMarkup }): Promise<void> {
    const fileId = this.cacheService.getFileId(imagePath) as string | undefined;

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
        { source: imagePath },
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
          this.cacheService.setFileId(imagePath, newFileId);
          console.log(`[Cache] Cached new file_id for ${imagePath}`);
        }
      }
    }
  }

  public async editPhoto(ctx: MyContext, imagePath: string, options: { caption: string; reply_markup: InlineKeyboardMarkup }): Promise<void> {
    const fileId = this.cacheService.getFileId(imagePath) as string | undefined;

    if (!fileId || !ctx.callbackQuery?.message) {
      if (ctx.callbackQuery?.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      await this.sendPhoto(ctx, imagePath, options);
      return;
    }

    await ctx.editMessageMedia(
      { type: 'photo', media: fileId, caption: options.caption, parse_mode: 'HTML' },
      { reply_markup: options.reply_markup },
    );
  }
}
