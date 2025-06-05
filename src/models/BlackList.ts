import { Database } from './Database';

interface BlackListData {
  userId: number;
  reason?: string;
  blockedAt: number;
}

export class BlackListModel extends Database<BlackListData> {
  constructor() {
    super('blacklist');
  }

  public async blockUser(userId: number, reason?: string): Promise<void> {
    const data: BlackListData = {
      userId,
      blockedAt: Date.now()
    };
    
    if (reason) {
      data.reason = reason;
    }
    
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