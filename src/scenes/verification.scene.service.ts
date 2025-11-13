import { Markup, Scenes } from 'telegraf';
import { type InlineKeyboardButton, type InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import { BotService } from '../bot/bot.service';
import { type MediaService } from '../bot/media.service';

import { type MyContext } from '../types/context.interface';
import { type UserService, VerificationStatus } from '../user/user.service';
import { type ISceneStep, type IVerificationContentService } from '../verification/verification.interface';

export class VerificationSceneService {
  constructor(
    private readonly userService: UserService,
    private readonly contentService: IVerificationContentService,
    private readonly mediaService: MediaService,
  ) {}

  public createScene(): Scenes.WizardScene<MyContext> {
    return new Scenes.WizardScene<MyContext>('verification', this.onEnterScene.bind(this), this.handleAnswer.bind(this));
  }

  private async onEnterScene(ctx: MyContext) {
    const state = ctx.wizard.state;
    if (!state || typeof state.userId === 'undefined' || typeof state.chatId === 'undefined') {
      console.error('Wizard state is not initialized properly');
      return ctx.scene.leave();
    }
    const { userId, chatId } = state;
    const status = this.userService.getVerificationStatus(userId, chatId);
    try {
      switch (status) {
        case VerificationStatus.ALLOWED:
          await this.showCurrentStep(ctx);
          return ctx.wizard.next();

        case VerificationStatus.LIMIT_REACHED:
          const tryLaterStep = this.contentService.getServiceStep('tryLater');
          //TODO: доделать конфиг интервала в env
          const text = tryLaterStep.text.replace('{interval}', 'неделю');
          if (tryLaterStep.image) {
            await this.mediaService.sendPhoto(ctx, tryLaterStep.image, {
              caption: text,
              reply_markup: { inline_keyboard: [] },
            });
          } else {
            await ctx.reply(text ?? 'Вы исчерпали все попытки. Обратитесь к администратору.');
          }
          return ctx.scene.leave();

        case VerificationStatus.USER_NOT_FOUND:
          this.userService.handleNewMemberJoined(userId, chatId);
          await this.showCurrentStep(ctx);
          return ctx.wizard.next();

        case VerificationStatus.ALREADY_VERIFIED:
          await ctx.reply('Вы уже прошли верификацию и можете писать в чате.');
          return ctx.scene.leave();
      }
    } catch (e) {
      console.error(`[Scene OnEnter] Failed to process scene entry for user ${userId}.`, e);
      return ctx.scene.leave();
    }
  }

  private async handleAnswer(ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      await ctx.reply('Пожалуйста, используйте кнопки для ответа.');
      return;
    }

    const userAnswer = ctx.callbackQuery.data;
    const { state } = ctx.wizard;

    if (!state || typeof state.currentStep === 'undefined' || !Array.isArray(state.answers)) {
      console.error('Wizard state is not properly initialized');
      return ctx.scene.leave();
    }

    if (state.currentStep < 0 || state.currentStep >= this.contentService.getSteps().length) {
      console.error('Current step is out of bounds');
      return ctx.scene.leave();
    }
    try {
      if (userAnswer === 'back') {
        if (state.currentStep > 0) {
          state.currentStep--;
          await this.showCurrentStep(ctx);
        } else {
          await ctx.answerCbQuery('Вы на первом шаге.', { show_alert: true });
        }
        return;
      } else if (userAnswer === 'next') {
        await ctx.answerCbQuery();
      } else {
        const userAnswerIndex = parseInt(userAnswer);
        if (isNaN(userAnswerIndex)) {
          await ctx.answerCbQuery('Некорректный ответ.', { show_alert: true });
          return;
        }

        const steps = this.contentService.getSteps();
        const currentStepData = steps[state.currentStep];
        if (!currentStepData || !currentStepData.options || userAnswerIndex >= currentStepData.options.length || userAnswerIndex < 0) {
          await ctx.answerCbQuery('Некорректный выбор.', { show_alert: true });
          return; // Прерываем, если индекс выходит за границы
        }

        state.answers[state.currentStep] = userAnswerIndex;
        await ctx.answerCbQuery('Ответ принят.');
      }
    } catch (e) {
      // Ловим ошибку, если callback_query устарел. Просто логируем.
      console.warn(`Could not answer callback query for user ${ctx.from?.id}`, e);
      return;
    }

    const nextStep = state.currentStep + 1;
    const steps = this.contentService.getSteps();
    if (nextStep >= steps.length) {
      return this.finishVerification(ctx);
    }

    state.currentStep = nextStep;
    await this.showCurrentStep(ctx);
  }

  private async showCurrentStep(ctx: MyContext) {
    const steps = this.contentService.getSteps();
    const { currentStep } = ctx.wizard.state;

    if (currentStep < 0 || currentStep >= steps.length) {
      console.error(`Invalid step index: ${currentStep}`);
      return ctx.scene.leave();
    }
    const stepData = steps[currentStep];

    const keyboard = this.buildKeyboard(stepData, currentStep, steps);

    const previousMessage = ctx.callbackQuery?.message;
    const wasMedia = previousMessage && 'photo' in previousMessage;
    const hasMediaNow = !!stepData.image;

    //Некоторые вопросы слишком длинные и не помещуются в кнопки, поэтому костылим вопросы в тексте сообщения
    let fullStepDataText = stepData.text;
    if (stepData?.options?.length) {
      const questionsText = stepData.options.map((option, idx) => `${idx + 1}. ${option}`).join('\n');
      fullStepDataText += `\n\n<blockquote>${questionsText}</blockquote>\n`;
    }

    try {
      if (!previousMessage) {
        if (hasMediaNow) {
          await this.mediaService.sendPhoto(ctx, stepData.image!, { caption: fullStepDataText, reply_markup: keyboard.reply_markup });
        } else {
          await ctx.reply(fullStepDataText, { parse_mode: 'HTML', ...keyboard });
        }
        return;
      }

      if (wasMedia === hasMediaNow) {
        if (hasMediaNow) {
          await this.mediaService.editPhoto(ctx, stepData.image!, { caption: fullStepDataText, reply_markup: keyboard.reply_markup });
        } else {
          await ctx.editMessageText(fullStepDataText, { parse_mode: 'HTML', ...keyboard });
        }
        return;
      }

      await ctx.deleteMessage(previousMessage.message_id);
      if (hasMediaNow) {
        await this.mediaService.sendPhoto(ctx, stepData.image!, { caption: fullStepDataText, reply_markup: keyboard.reply_markup });
      } else {
        await ctx.reply(fullStepDataText, { parse_mode: 'HTML', ...keyboard });
      }
    } catch (e) {
      console.error(`[Scene] Failed to show step ${currentStep} for user ${ctx.from?.id}.`, e);
      try {
        await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте начать проверку заново, написав /restart.');
      } catch (e) {
        console.error(`[Scene] Failed to even send an error message to user ${ctx.from?.id}.`, e);
      }
      return ctx.scene.leave();
    }
  }

  private buildKeyboard(step: ISceneStep, currentStepIndex: number, allSteps: ISceneStep[]): Markup.Markup<InlineKeyboardMarkup> {
    let buttonRows: InlineKeyboardButton[][];

    if (step.options) {
      buttonRows = step.options.map((option, idx) => {
        //const buttonText = `${idx + 1}. ${option.length >= 50 ? option.substring(0, 47)+'...' : option}`;
        const buttonText = `${idx + 1}. ${option}`;
        return [Markup.button.callback(buttonText, idx.toString())];
      });
    } else if (step.buttonText) {
      buttonRows = [[Markup.button.callback(step.buttonText, 'next')]];
    } else {
      buttonRows = [[Markup.button.callback('Далее ➡️', 'next')]];
    }

    const firstQuestionIndex = allSteps.findIndex((s) => s.options);
    if (step.options && currentStepIndex > firstQuestionIndex) {
      buttonRows.push([Markup.button.callback('⬅️ Назад', 'back')]);
    }

    return Markup.inlineKeyboard(buttonRows);
  }

  private async finishVerification(ctx: MyContext) {
    const { chatId, userId, answers } = ctx.wizard.state;
    const steps = this.contentService.getSteps();
    const passThreshold = this.contentService.getPassThreshold();

    let score = 0;
    steps.forEach((step, index) => {
      if (step.correctAnswers) {
        const userAnswer = answers[index];
        if (typeof userAnswer !== 'undefined' && step.correctAnswers.includes(userAnswer)) {
          score++;
        }
      }
    });

    if (ctx.callbackQuery?.message) {
      try {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      } catch (e) {
        console.warn(`Could not delete previous message for user ${userId}:`, e);
      }
    }

    if (score >= passThreshold) {
      const successStep = this.contentService.getServiceStep('success');
      try {
        //размут
        await ctx.telegram.restrictChatMember(chatId, userId, {
          permissions: BotService.unmutePermissions,
        });
        this.userService.grantChatAccess(userId, chatId);
        if (successStep.image) {
          await this.mediaService.sendPhoto(ctx, successStep.image, { caption: successStep.text, reply_markup: { inline_keyboard: [] } });
        } else {
          await ctx.reply(successStep.text ?? 'Поздравляем! Вы прошли проверку.');
        }
      } catch (e) {
        console.error(`[Scene] CRITICAL: Failed to unmute user ${userId} in chat ${chatId}.`, e);
        const errorStep = this.contentService.getServiceStep('error');
        await ctx.reply(errorStep.text ?? 'Произошла критическая ошибка. Обратитесь к администратору.');
      }
    } else {
      const attempts = this.userService.recordQuizAttempt(userId, chatId);
      if (attempts !== false) {
        const failStep = this.contentService.getServiceStep('fail');
        const MAX_ATTEMPTS = 3; //TODO: вынести в env
        const remainingAttempts = MAX_ATTEMPTS - attempts;
        let text = failStep.text.replace('{count}', remainingAttempts.toString());
        if ([2, 3, 4].includes(remainingAttempts)) {
          text = text.replace('{try_noun}', 'попытки');
        } else if (remainingAttempts === 1) {
          text = text.replace('{try_noun}', 'попытка');
        } else {
          text = text.replace('{try_noun}', 'попыток');
        }
        //
        try {
          if (failStep.image) {
            await this.mediaService.sendPhoto(ctx, failStep.image, { caption: text, reply_markup: { inline_keyboard: [] } });
          } else {
            await ctx.reply(text);
          }
        } catch (e) {
          console.error(`[Scene] Failed to show failure message to user ${userId}.`, e);
        }
      }
    }

    ctx.scene.state = {};
    return ctx.scene.leave();
  }
}
