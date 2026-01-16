import { config } from 'dotenv';

import { type IConfigService } from './config.interface';

import { Injectable } from '../utils/DI.container';

@Injectable()
export class ConfigService implements IConfigService {
  constructor() {
    config();
  }

  public get(key: string, byDefault?: string): string {
    const value = process.env[key] ?? byDefault;

    if (typeof value === 'undefined') {
      throw new Error(`[ConfigService] Configuration key '${key}' is not set in environment variables.`);
    }

    return value;
  }
}
