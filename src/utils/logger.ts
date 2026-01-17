import { inspect } from 'util';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export class Logger {
  constructor(private readonly context: string) {}

  public info(message: string, meta?: unknown): void {
    this.print(LogLevel.INFO, message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.print(LogLevel.WARN, message, meta);
  }

  public error(message: string, error?: unknown): void {
    this.print(LogLevel.ERROR, message, error);
  }

  public debug(message: string, meta?: unknown): void {
    this.print(LogLevel.DEBUG, message, meta);
  }

  private print(level: LogLevel, message: string, meta?: unknown): void {
    const now = new Date();

    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');

    const hours = `${now.getHours()}`.padStart(2, '0');
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    const seconds = `${now.getSeconds()}`.padStart(2, '0');
    const milliseconds = `${now.getMilliseconds()}`.padStart(3, '0');

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

    const metaString = meta ? `\n${this.formatMeta(meta)}` : '';

    const logMessage = `[${timestamp}] [${level}] [${this.context}] ${message}${metaString}`;

    switch (level) {
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  //от циклических
  private formatMeta(meta: unknown): string {
    if (meta instanceof Error) {
      return inspect(meta, { colors: true, depth: null });
    }
    if (typeof meta === 'object' && meta !== null) {
      return inspect(meta, { colors: true, depth: 3 });
    }
    return String(meta);
  }
}
