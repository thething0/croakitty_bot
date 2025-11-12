export interface IConfigService {
  get(key: string, byDefault?: string): string;
}
