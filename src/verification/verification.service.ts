import * as fs from 'node:fs';
import path from 'node:path';

import { type IConfigService } from '../config/config.interface';

import { type ISceneStep, type IVerificationContentService } from './verification.interface';

export class VerificationContentService implements IVerificationContentService {
  private readonly steps!: ISceneStep[];
  private readonly serviceSteps!: Record<string, ISceneStep>;

  constructor(private readonly configService: IConfigService) {
    const contentPath = this.configService.get('VALIDATION_DATA', 'data/steps.json');
    const absolutePath = path.join(process.cwd(), contentPath);

    try {
      //нет смысла в асинхронности, подгрузка раз при старте
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const questions = JSON.parse(fileContent) as {
        steps: ISceneStep[];
        serviceSteps: Record<string, ISceneStep>;
      };

      if (!questions.steps || !questions.serviceSteps) {
        throw new Error('Content file is missing "steps" or "serviceSteps" properties.');
      }

      this.steps = questions.steps;
      this.serviceSteps = questions.serviceSteps;
      console.log(`✅ Content loaded successfully from ${contentPath}`);
    } catch (e) {
      console.error(`[ContentService] FATAL: Could not read or parse content file at ${absolutePath}.`, e);
      process.exit(1);
    }
  }

  public getPassThreshold(): number {
    // Считаем только шаги, которые являются вопросами
    return this.steps.filter((step) => step.options).length;
  }

  public getSteps(): ISceneStep[] {
    return this.steps;
  }
  public getServiceStep(step: string): ISceneStep {
    return this.serviceSteps?.[step];
  }
}
