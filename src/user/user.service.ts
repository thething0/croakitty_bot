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
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly dbService: DatabaseService) {}

  public findUser(id: number): UserRecord {
    const existingUser = this.dbService.findUser(id);
    return <UserRecord>existingUser;
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
      this.dbService.updateUser(userId, chatId, { attempts: user.attempts + 1 });
      return user.attempts + 1;
    }
    return false;
  }

  public grantChatAccess(userId: number, chatId: number): void {
    this.dbService.updateUser(userId, chatId, { is_muted: false });
  }

  public findAllUserRecords(userId: number): UserRecord[] {
    return this.dbService.findAllUserRecords(userId);
  }
}
