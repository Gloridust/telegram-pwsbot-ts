import { bot } from '../core/bot';
import { configManager } from '../core/config';

export enum ErrorType {
  DATABASE = 'DATABASE',
  TELEGRAM_API = 'TELEGRAM_API', 
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN'
}

export class ErrorHandler {
  private static errorCount: Map<string, number> = new Map();
  private static readonly MAX_ERRORS_PER_TYPE = 10;
  private static readonly ERROR_RESET_INTERVAL = 3600000; // 1小时

  static {
    // 定期重置错误计数
    setInterval(() => {
      this.errorCount.clear();
    }, this.ERROR_RESET_INTERVAL);
  }

  public static async handle(error: any, context: {
    userId?: number;
    chatId?: number;
    action?: string;
    type?: ErrorType;
  }): Promise<void> {
    const errorType = context.type || ErrorType.UNKNOWN;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = {
      ...context,
      timestamp: new Date().toISOString(),
      errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    };

    // 记录错误到控制台
    console.error(`[${errorType}] ${context.action || 'Unknown Action'}:`, errorDetails);

    // 增加错误计数
    const currentCount = this.errorCount.get(errorType) || 0;
    this.errorCount.set(errorType, currentCount + 1);

    // 如果某类错误频繁发生，通知管理员
    if (currentCount + 1 === this.MAX_ERRORS_PER_TYPE) {
      await this.notifyAdmin(errorType, errorDetails);
    }

    // 发送用户友好的错误消息
    if (context.chatId) {
      const userMessage = this.getUserFriendlyMessage(errorType, errorMessage);
      try {
        await bot.sendMessage(context.chatId, userMessage);
      } catch (sendError) {
        console.error('发送错误消息失败:', sendError);
      }
    }

    // 特殊错误处理
    await this.handleSpecialErrors(error, errorType, context);
  }

  private static getUserFriendlyMessage(type: ErrorType, _details?: string): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.DATABASE]: '❌ 数据处理出错，请稍后重试',
      [ErrorType.TELEGRAM_API]: '❌ Telegram 服务暂时不可用，请稍后重试',
      [ErrorType.VALIDATION]: '❌ 输入内容有误，请检查后重试',
      [ErrorType.PERMISSION]: '❌ 您没有权限执行此操作',
      [ErrorType.NOT_FOUND]: '❌ 找不到相关内容',
      [ErrorType.UNKNOWN]: '❌ 发生未知错误，请联系管理员'
    };

    return messages[type] || messages[ErrorType.UNKNOWN];
  }

  private static async notifyAdmin(type: ErrorType, details: any): Promise<void> {
    const adminId = configManager.admin;
    if (!adminId) return;

    const message = `⚠️ 系统错误报告

错误类型: ${type}
发生时间: ${details.timestamp}
错误频率: ${this.errorCount.get(type)}次/小时

错误详情:
${JSON.stringify(details, null, 2).substring(0, 500)}...

请检查系统日志了解详情。`;

    try {
      await bot.sendMessage(adminId, message);
    } catch (error) {
      console.error('通知管理员失败:', error);
    }
  }

  private static async handleSpecialErrors(error: any, _type: ErrorType, context: any): Promise<void> {
    // 处理特殊的 Telegram API 错误
    if (error?.response?.body?.error_code) {
      const errorCode = error.response.body.error_code;
      
      switch (errorCode) {
        case 403: // Bot被踢出或被拉黑
          if (context.chatId && error.response.body.description?.includes('bot was kicked')) {
            console.error(`Bot被踢出聊天: ${context.chatId}`);
            // 可以在这里清理相关数据
          }
          break;
        
        case 429: // 请求过多
          console.warn('API请求过多，需要降低请求频率');
          break;
      }
    }
  }

  public static isRecoverableError(error: any): boolean {
    if (error?.response?.body?.error_code) {
      const recoverableCodes = [429, 500, 502, 503, 504];
      return recoverableCodes.includes(error.response.body.error_code);
    }
    return false;
  }

  public static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRecoverableError(error) || i === maxRetries - 1) {
          throw error;
        }
        
        console.log(`操作失败，${delay}ms后重试 (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 指数退避
      }
    }
    
    throw lastError;
  }
} 