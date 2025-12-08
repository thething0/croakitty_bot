import { Scenes } from 'telegraf';

import { type IConfigService } from '../config/config.interface';

import { BotService } from '../bot/bot.service';

import { type VerificationContext } from '../types/context.interface';
import { type UserService, VerificationStatus } from '../user/user.service';
import { type ISceneStep } from '../verification/verification.interface';
import { type VerificationContentService } from '../verification/verification.service';
import { type ButtonData, type VerificationView, type ViewData } from '../verification/verification.view';

export class QuestionsScene {
  constructor(
    private readonly configService: IConfigService,
    private readonly userService: UserService,
    private readonly contentService: VerificationContentService,
    private readonly view: VerificationView,
  ) {}

  public create(): Scenes.WizardScene<VerificationContext> {
    return new Scenes.WizardScene<VerificationContext>('questions', this.onEnterScene.bind(this), this.handleAnswer.bind(this));
  }

  private async onEnterScene(ctx: VerificationContext) {
    const state = ctx.wizard.state;
    if (!state || typeof state.userId === 'undefined' || typeof state.chatId === 'undefined') {
      console.error('[QuestionsScene] State is not initialized properly');
      return ctx.scene.leave();
    }
    const { userId, chatId } = state;
    try {
      const status = this.userService.getVerificationStatus(userId, chatId);

      switch (status) {
        case VerificationStatus.USER_NOT_FOUND:
          this.userService.handleNewMemberJoined(userId, chatId);
        // falls through
        case VerificationStatus.ALLOWED:
          const questions = this.contentService.getQuestions();
          const qData = this.getQuestionViewData(questions[0], 0, questions.length);
          await this.view.show(ctx, qData);
          return ctx.wizard.next();

        case VerificationStatus.LIMIT_REACHED:
          const tryLaterStep = this.contentService.getServiceStep('tryLater');

          const intervalHours = +this.configService.get('RESET_INTERVAL_H', '168');
          const intervalText = this.getIntervalText(intervalHours);
          const text = tryLaterStep.text.replace('{interval}', intervalText);

          await this.view.show(ctx, {
            text: text ?? 'Вы исчерпали все попытки. Обратитесь к администратору.',
            image: tryLaterStep.image,
            buttons: [],
          }); //тут и далее
          return ctx.scene.leave();

        case VerificationStatus.ALREADY_VERIFIED:
          await ctx.reply('Вы уже прошли верификацию и можете писать в чате.');
          return ctx.scene.leave();
      }
    } catch (e) {
      console.error(`[QuestionsScene] Failed to process scene entry for user ${userId}.`, e);
      return ctx.scene.leave();
    }
  }

  private async handleAnswer(ctx: VerificationContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }
    try {
      const { state } = ctx.wizard;
      const steps = this.contentService.getQuestions();
      const answer = ctx.callbackQuery.data;

      if (!state || typeof state.currentStep === 'undefined' || !Array.isArray(state.answers)) {
        console.error('[QuestionsScene] Wizard state is not properly initialized');
        return ctx.scene.leave();
      }
      if (state.currentStep < 0 || state.currentStep >= steps.length) {
        console.error('[QuestionsScene] Current step is out of bounds');
        return ctx.scene.leave();
      }

      if (answer === 'back') {
        if (state.currentStep > 0) {
          state.currentStep--;
          state.answers.pop();
          const qData = this.getQuestionViewData(steps[state.currentStep], state.currentStep, steps.length);

          await this.view.show(ctx, qData);
        } else {
          await ctx.answerCbQuery('Вы на первом шаге.', { show_alert: true });
        }
        return;
      }
      // Обработка ответа
      const currentStepData = steps[state.currentStep];
      const userAnswerIndex = +answer;
      if (isNaN(userAnswerIndex)) {
        return;
      }
      if (!currentStepData || !currentStepData.options || userAnswerIndex >= currentStepData.options.length || userAnswerIndex < 0) {
        await ctx.answerCbQuery('Некорректный выбор.', { show_alert: true });
        return;
      }

      state.answers[state.currentStep] = userAnswerIndex;
      state.currentStep++;

      if (state.currentStep >= steps.length) {
        return await this.finishVerification(ctx);
      }

      const qData = this.getQuestionViewData(steps[state.currentStep], state.currentStep, steps.length);
      await this.view.show(ctx, qData);
    } catch (e) {
      console.warn(`[QuestionScene] Could not answer callback query for user ${ctx.from?.id}`, e);
      return;
    } finally {
      await ctx.answerCbQuery().catch(() => {});
    }
  }

  private async finishVerification(ctx: VerificationContext) {
    const { chatId, userId, answers } = ctx.wizard.state;
    const questions = this.contentService.getQuestions();
    const passThreshold = this.contentService.getPassThreshold();

    const score = questions.reduce((acc, step, index) => (step.correctAnswers?.includes(answers[index] ?? -1) ? acc + 1 : acc), 0);

    //удаляем сообщение с тестом
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      } catch (e) {
        console.warn(`[QuestionScene] Could not delete previous message for user ${userId}:`, e);
      }
    }

    if (score >= passThreshold) {
      try {
        //размут
        await ctx.telegram.restrictChatMember(chatId, userId, {
          permissions: BotService.unmutePermissions,
        });
        this.userService.grantChatAccess(userId, chatId);
        const successStep = this.contentService.getServiceStep('success');

        await this.view.show(ctx, {
          text: successStep.text,
          image: successStep.image,
          buttons: [], // Кнопок нет
        });
      } catch (e) {
        console.error(`[QuestionsScene] Failed to unmute user ${userId}`, e);
        const errorStep = this.contentService.getServiceStep('error');
        await this.view.show(ctx, {
          text: errorStep.text ?? 'Произошла ошибка. Свяжитесь с админом.',
          image: errorStep.image,
          buttons: [],
        });
      }
    } else {
      // --- ПРОВАЛ ---
      const attempts = this.userService.recordVerificationAttempt(userId, chatId);
      const maxAttempts = +this.configService.get('MAX_ATTEMPTS', '3'); //из env
      const currentAttempts = attempts === false ? maxAttempts : attempts;
      const remaining = maxAttempts - currentAttempts;

      if (remaining > 0) {
        const failStep = this.contentService.getServiceStep('fail');
        const text = failStep.text.replace('{count}', remaining.toString()).replace('{try_noun}', this.getTryNoun(remaining));
        const buttons = [{ text: 'Попробовать снова', data: `restart_verification:${chatId}` }];

        await this.view.show(ctx, {
          text,
          image: failStep.image,
          buttons,
        });
      } else {
        const tryLaterStep = this.contentService.getServiceStep('tryLater');
        const intervalHours = +this.configService.get('RESET_INTERVAL_H', '168');
        const intervalText = this.getIntervalText(intervalHours);
        const text = tryLaterStep.text.replace('{interval}', intervalText);

        await this.view.show(ctx, {
          text,
          image: tryLaterStep.image,
          buttons: [],
        });
      }
    }

    ctx.scene.state = {};
    return ctx.scene.leave();
  }

  private getQuestionViewData(step: ISceneStep, stepIndex: number, totalSteps: number): ViewData {
    const header = `<b>Вопрос ${stepIndex + 1}/${totalSteps}</b>\n\n`;
    const optionsText = step.options?.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
    const fullText = `${header}${step.text}${optionsText ? `\n\n<blockquote>${optionsText}</blockquote>` : ''}`;

    const buttons: ButtonData[] = [];
    if (step.options?.length) {
      const answerButtons = step.options.map((text, idx) => ({ text: `${idx + 1}. ${text}`, data: idx.toString() }));
      buttons.push(...answerButtons);
    }

    if (stepIndex > 0) {
      buttons.push({ text: 'Назад', data: 'back' });
    }

    return {
      text: fullText,
      image: step.image,
      buttons: buttons,
    };
  }

  //хелперы
  private getTryNoun(count: number): string {
    if (count === 1) return 'попытка';
    if ([2, 3, 4].includes(count)) return 'попытки';
    return 'попыток';
  }

  private getIntervalText(hours: number): string {
    const days = Math.round(hours / 24);
    if (days === 1) return '1 день';
    if (days > 1 && days < 5) return `${days} дня`;
    if (days >= 5) return `${days} дней`;
    return `${hours} часов`;
  }
}
