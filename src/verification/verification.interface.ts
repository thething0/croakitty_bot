export interface ISceneStep {
  text: string;
  image?: string;
  options?: string[];
  correctAnswers?: number[];
  buttonText?: string;
}

export interface IVerificationContentService {
  getSteps(): ISceneStep[];
  getServiceStep(step: string): ISceneStep;
  getPassThreshold(): number;
}
