import { configManager } from '../core/config';
import updateDotenv from 'update-dotenv';

export class Helper {
  // 检查是否在夜间静音时间内
  public static isNightMode(): boolean {
    const autoMute = configManager.autoMute;
    if (!autoMute) {
      return false;
    }

    const now = new Date();
    const hour = now.getHours();
    
    // 夜间静音时间：00:00-06:50 (6:50 AM)
    return hour >= 0 && hour < 7;
  }

  // 更新配置文件
  public static async updateConfig(updates: Record<string, string | number>): Promise<void> {
    try {
      await updateDotenv(updates);
      console.log('配置已更新:', updates);
    } catch (error) {
      console.error('更新配置失败:', error);
    }
  }

  // 生成唯一ID
  public static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // 格式化时间戳
  public static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // 提取用户名
  public static getUserDisplayName(user: { 
    username?: string; 
    first_name?: string; 
    last_name?: string; 
  }): string {
    if (user.username) {
      return `@${user.username}`;
    }
    
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || '未知用户';
  }

  // 验证管理员权限
  public static isAdmin(userId: number): boolean {
    const adminId = parseInt(configManager.admin);
    return userId === adminId;
  }

  // 延迟执行
  public static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 安全的JSON解析
  public static safeJsonParse<T>(str: string, defaultValue: T): T {
    try {
      return JSON.parse(str) as T;
    } catch {
      return defaultValue;
    }
  }

  // 验证频道ID格式
  public static isValidChannelId(channelId: string): boolean {
    return /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(channelId);
  }

  // 清理HTML标签
  public static stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  // 截断文本
  public static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
} 