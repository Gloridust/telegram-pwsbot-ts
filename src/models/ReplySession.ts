import { Database } from './Database';
import { ReplySession } from '../types';

export class ReplySessionModel extends Database<ReplySession> {
  constructor() {
    super('reply_sessions');
  }

  public async startSession(userId: number, adminId: number): Promise<void> {
    const session: ReplySession = {
      userId,
      adminId,
      isActive: true,
      startTime: Date.now()
    };
    await this.add(userId.toString(), session);
  }

  public async endSession(userId: number): Promise<boolean> {
    const session = await this.get(userId.toString());
    if (!session) {
      return false;
    }

    session.isActive = false;
    await this.add(userId.toString(), session);
    return true;
  }

  public async getActiveSession(userId: number): Promise<ReplySession | null> {
    const session = await this.get(userId.toString());
    return session && session.isActive ? session : null;
  }

  public async isInSession(userId: number): Promise<boolean> {
    const session = await this.getActiveSession(userId);
    return session !== null;
  }

  public async getActiveSessions(): Promise<ReplySession[]> {
    const all = await this.getAll();
    return all.filter(session => session.isActive);
  }

  public async cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const all = await this.getAll();
    const now = Date.now();
    let cleaned = 0;

    for (const session of all) {
      if (now - session.startTime > maxAge) {
        await this.remove(session.userId.toString());
        cleaned++;
      }
    }

    return cleaned;
  }
} 