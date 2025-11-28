import { type IConfigService } from '../config/config.interface';

import { type DatabaseService, type UserRecord } from '../database/database.service';

/**
 * Сервис бизнес-логики для управления пользователями.
 * Инкапсулирует правила: количество попыток, статусы мьюта и т.д.
 */
export enum VerificationStatus {
  ALLOWED,
  LIMIT_REACHED,
  USER_NOT_FOUND,
  ALREADY_VERIFIED,
}

export class UserService {
  private readonly MAX_ATTEMPTS: number;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly configService: IConfigService,
  ) {
    this.MAX_ATTEMPTS = +this.configService.get('MAX_ATTEMPTS', '3');
  }

  public handleNewMemberJoined(userId: number, chatId: number): void {
    const existingUser = this.dbService.findUser(userId, chatId);
    if (!existingUser) {
      this.dbService.createUser(userId, chatId);
    }
  }

  public getVerificationStatus(userId: number, chatId: number): VerificationStatus {
    const user = this.dbService.findUser(userId, chatId);

    if (!user) {
      return VerificationStatus.USER_NOT_FOUND;
    }

    if (!user.is_muted) {
      return VerificationStatus.ALREADY_VERIFIED;
    }

    if (user.attempts >= this.MAX_ATTEMPTS) {
      return VerificationStatus.LIMIT_REACHED;
    }

    return VerificationStatus.ALLOWED;
  }

  public recordQuizAttempt(userId: number, chatId: number): false | number {
    const user = this.dbService.findUser(userId, chatId);
    if (user) {
      this.dbService.updateUser(userId, chatId, { attempts: user.attempts + 1, last_attempt: Date.now() });
      return user.attempts + 1;
    }
    return false;
  }

  public grantChatAccess(userId: number, chatId: number): void {
    this.dbService.updateUser(userId, chatId, { is_muted: false, last_attempt: Date.now() });
  }

  public findAllUserRecords(userId: number): UserRecord[] {
    return this.dbService.findAllUserRecords(userId);
  }
}
