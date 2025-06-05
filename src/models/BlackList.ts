import { Database } from './Database';
import { UserData } from '../types';

export class BlackListModel extends Database<{ userId: number; reason?: string; blockedAt: number }> {
  constructor() {
    super('blacklist');
  }

  public async addToBlacklist(userId: number, reason?: string): Promise<void> {
    const data = {
      userId,
      reason,
      blockedAt: Date.now()
    };
    await this.add(userId.toString(), data);
  }

  public async removeFromBlacklist(userId: number): Promise<boolean> {
    return await this.remove(userId.toString());
  }

  public async isBlocked(userId: number): Promise<boolean> {
    return await this.exists(userId.toString());
  }

  public async getBlockedUsers(): Promise<{ userId: number; reason?: string; blockedAt: number }[]> {
    return await this.getAll();
  }

  public async getBlockInfo(userId: number): Promise<{ userId: number; reason?: string; blockedAt: number } | null> {
    return await this.get(userId.toString());
  }
} 