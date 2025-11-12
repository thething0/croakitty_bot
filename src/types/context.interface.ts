import { type Context, type Scenes } from 'telegraf'; // Шаг 1: Описываем данные, которые нам нужно хранить в состоянии сцены.

interface MyWizardState {
  chatId: number;
  userId: number;
  currentStep: number;
  answers: number[];
}

type MyWizardSessionData = Scenes.WizardSessionData & { state: MyWizardState };
export type MyWizardSession = Scenes.WizardSession<MyWizardSessionData>;

export interface MyContext extends Context {
  session: MyWizardSession;
  scene: Scenes.SceneContextScene<MyContext, MyWizardSessionData>;
  wizard: Scenes.WizardContextWizard<MyContext> & { state: MyWizardState };
}
