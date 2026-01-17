import { Scenes } from 'telegraf';

import { Injectable } from '../utils/DI.container';
import { Logger } from '../utils/logger';
import { escapeHTML } from '../utils/text.utils';

import { type VerificationContext } from '../types/context.interface';
import { type ISceneStep } from '../verification/verification.interface';
import { VerificationContentService } from '../verification/verification.service';
import { type ButtonData, VerificationView, type ViewData } from '../verification/verification.view';

@Injectable()
export class RulesScene {
  private readonly logger = new Logger('RulesScene');
  constructor(
    private readonly contentService: VerificationContentService,
    private readonly view: VerificationView,
  ) {}

  public create(): Scenes.WizardScene<VerificationContext> {
    return new Scenes.WizardScene<VerificationContext>('rules', this.onEnterScene.bind(this), this.handleAnswer.bind(this));
  }

  private async onEnterScene(ctx: VerificationContext) {
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
