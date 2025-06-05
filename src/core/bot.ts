import TeleBot from 'node-telegram-bot-api';
import { configManager } from './config';
import { CallbackVars } from '../types';

// 创建机器人实例
export const bot = new TeleBot(configManager.token, { polling: true });

// 回调查询数据常量
export const callbackVars: CallbackVars = {
  REC_ANY: 'receive:anonymous',
  REC_REAL: 'receive:real',
  SUB_ANY: 'submission_type:anonymous',
  SUB_REAL: 'submission_type:real',
  SUB_CANCEL: 'cancel:submission',
  BOT_NOAUTH_KICK: 'ETELEGRAM: 403 Forbidden: bot was kicked from the channel chat',
  BOT_NOAUTH: 'ETELEGRAM: 403 Forbidden: bot is not a member of the channel chat',
  BOT_BLOCK: 'ETELEGRAM: 403 Forbidden: bot was blocked by the user',
};

// 获取并保存机器人信息
export const initializeBotInfo = async (): Promise<void> => {
  try {
    const info = await bot.getMe();
    configManager.updateConfig({
      BotID: info.id,
      BotUserName: info.username || ''
    });
    console.log(`机器人初始化成功: @${info.username} (ID: ${info.id})`);
  } catch (error) {
    console.error('机器人初始化失败:', error);
    throw error;
  }
}; 