import { type Context, type Scenes } from 'telegraf';

interface VerificationState {
  chatId: number;
  userId: number;
  currentStep: number;
  answers: number[];
}

type VerificationSessionData = Scenes.WizardSessionData & { state: VerificationState };
export type VerificationSession = Scenes.WizardSession<VerificationSessionData>;

export interface VerificationContext extends Context {
  session: VerificationSession;
  scene: Scenes.SceneContextScene<VerificationContext, VerificationSessionData>;
  wizard: Scenes.WizardContextWizard<VerificationContext> & { state: VerificationState };
}
