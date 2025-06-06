import { Database } from '../models/Database';
import { UserState } from '../types';

export class UserStateManager extends Database<UserState> {
  constructor() {
    super('user_states');
  }

  public async setUserState(userId: number, state: 'normal' | 'pending_submission' | 'adding_comment', data?: any): Promise<void> {
    const userState: UserState = {
      userId,
      state,
      data,
      timestamp: Date.now()
    };
    
    console.log(`💾 UserStateManager: 保存用户状态 - userId: ${userId}, state: ${state}`);
    await this.add(userId.toString(), userState);
  }

  public async getUserState(userId: number): Promise<UserState | null> {
    const state = await this.get(userId.toString());
    console.log(`🔍 UserStateManager: 读取用户状态 - userId: ${userId}, state: ${state?.state}, hasData: ${!!state?.data}`);
    return state;
  }

  public async clearUserState(userId: number): Promise<boolean> {
    return await this.remove(userId.toString());
  }

  public async cleanExpiredStates(maxAge: number = 3600000): Promise<void> {
    // 清理超过1小时的过期状态
    const allStates = await this.getAll();
    const now = Date.now();
    
    for (const state of allStates) {
      if (now - state.timestamp > maxAge) {
        await this.remove(state.userId.toString());
      }
    }
  }
} 