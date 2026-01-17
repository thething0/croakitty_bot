import { Scenes } from 'telegraf';

import { ConfigService } from '../config/config.service';

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';
import { escapeHTML, getIntervalText } from '../utils/text.utils';

import { type VerificationContext } from '../types/context.interface';
import { UserService, VerificationStatus } from '../user/user.service';
import { type ISceneStep } from '../verification/verification.interface';
import { VerificationContentService } from '../verification/verification.service';
import { type ButtonData, VerificationView, type ViewData } from '../verification/verification.view';

@Injectable()
export class RulesScene {
  private readonly logger = new Logger('RulesScene');
  constructor(
    private readonly contentService: VerificationContentService,
    private readonly view: VerificationView,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  public create(): Scenes.WizardScene<VerificationContext> {
    return new Scenes.WizardScene<VerificationContext>('rules', this.onEnterScene.bind(this), this.handleAnswer.bind(this));
  }

  private async onEnterScene(ctx: VerificationContext) {
    const state = ctx.wizard.state;
    if (!state || typeof state.userId === 'undefined' || typeof state.chatId === 'undefined') {
      this.logger.error('State is not initialized properly in RulesScene');
      return ctx.scene.leave();
    }
    const { userId, chatId } = state;

    const status = this.userService.getVerificationStatus(userId, chatId);

    // Если попытки исчерпаны, показываем экран ожидания и выходим
    if (status === VerificationStatus.LIMIT_REACHED) {
      this.logger.info(
        `User ${userId} tried to start verification for chat ${chatId} but attempts are limited. Showing 'tryLater' screen.`,
      );

      const tryLaterStep = this.contentService.getServiceStep('tryLater');
      const intervalHours = +this.configService.get('RESET_INTERVAL_H', '168');
      const intervalText = getIntervalText(intervalHours);
      const text = tryLaterStep.text.replace('{interval}', intervalText);
      const buttons = [{ text: 'Попробовать снова', data: `restart_verification:${chatId}` }];

      await this.view.show(ctx, { text, image: tryLaterStep.image, buttons });
      return ctx.scene.leave();
    }

    try {
      const rules = this.contentService.getRuleSteps();
      if (rules.length === 0) {
        return ctx.scene.enter('questions', {
          ...ctx.scene.state,
          currentStep: 0, // форсируем 0
          answers: [],
        }); //Сразу к тесту, если правил нет
      }

      ctx.wizard.state.currentStep = 0;
      const viewData = this.getRuleViewData(rules[0], 0);
      await this.view.show(ctx, viewData);
      return ctx.wizard.next();
    } catch (e) {
      this.logger.error('Entry error', e);
    }
  }

  private async handleAnswer(ctx: VerificationContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const rawAction = ctx.callbackQuery.data;
    if (!rawAction.startsWith('rules_')) {
      this.logger.warn(`RulesScene received foreign callback: ${rawAction}. Re-rendering current view.`);
      const rules = this.contentService.getRuleSteps();
      const viewData = this.getRuleViewData(rules[ctx.wizard.state.currentStep], ctx.wizard.state.currentStep);
      await this.view.show(ctx, viewData); // Перерисовываем
      await ctx.answerCbQuery('Пожалуйста, используйте кнопки на текущем сообщении.');
      return;
    }
    const action = rawAction.replace('rules_', ''); // Убираем префикс

    const rules = this.contentService.getRuleSteps();
    const state = ctx.wizard.state;
    try {
      if (action === 'back') {
        if (state.currentStep > 0) {
          state.currentStep--;
          const viewData = this.getRuleViewData(rules[state.currentStep], state.currentStep);
          await this.view.show(ctx, viewData);
        } else {
          await ctx.answerCbQuery('Это начало.');
        }
        return;
      }

      if (action === 'next') {
        state.currentStep++;
        if (state.currentStep >= rules.length) {
          return ctx.scene.enter('questions', {
            ...ctx.scene.state,
            currentStep: 0,
            answers: [],
          });
        }

        const viewData = this.getRuleViewData(rules[state.currentStep], state.currentStep);
        await this.view.show(ctx, viewData);
      }
    } catch (e) {
      this.logger.error('Action error', e);
    } finally {
      await ctx.answerCbQuery().catch(() => {});
    }
  }

  private getRuleViewData(step: ISceneStep, stepIndex: number): ViewData {
    const buttons: ButtonData[] = [];

    const btnText = step.buttonText || 'Понятно';
    buttons.push({ text: btnText, data: 'rules_next' });

    if (stepIndex > 0) {
      buttons.push({ text: '⬅️ Назад', data: 'rules_back' });
    }

    return {
      text: escapeHTML(step.text),
      image: step.image,
      buttons: buttons,
    };
  }
}
