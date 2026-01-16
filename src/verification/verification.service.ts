import * as fs from 'node:fs';
import path from 'node:path';

import { ConfigService } from '../config/config.service';

import { Injectable } from '../utils/DI.container';

import { type ISceneStep } from './verification.interface';

@Injectable()
export class VerificationContentService {
  private readonly rules!: ISceneStep[];
  private readonly questions!: ISceneStep[];
  private readonly misc!: Record<string, ISceneStep>;

  constructor(private readonly configService: ConfigService) {
    const contentPath = this.configService.get('CONTENT_PATH', 'data/steps.json');
    const absolutePath = path.join(process.cwd(), contentPath);

    try {
      //нет смысла в асинхронности, подгрузка раз при старте
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const data = JSON.parse(fileContent) as {
        rules: ISceneStep[];
        questions: ISceneStep[];
        misc: Record<string, ISceneStep>;
      };

      if (!data.rules || !data.questions || !data.misc) {
        throw new Error('Content file is missing "steps" or "serviceSteps" properties.');
      }

      this.rules = data.rules;
      this.questions = data.questions;
      this.misc = data.misc;
      console.log(`[ContentService] Content loaded successfully from ${contentPath}`);
    } catch (e) {
      console.error(`[ContentService] Could not read or parse content file at ${absolutePath}.`, e);
    }
  }

  public getRuleSteps(): ISceneStep[] {
    return this.rules;
  }

  public getQuestions(): ISceneStep[] {
    return this.questions;
  }

  public getPassThreshold(): number {
    return this.questions.length - 1; //TODO: настроить через env
  }

  public getServiceStep(step: string): ISceneStep {
    return this.misc?.[step];
  }
}
