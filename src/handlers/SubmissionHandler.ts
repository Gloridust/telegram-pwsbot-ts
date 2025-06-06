import type { Message } from 'node-telegram-bot-api';
import { MessageHandler } from './MessageHandler';
import { bot, callbackVars } from '../core/bot';
import { configManager } from '../core/config';
import { Helper } from '../utils/Helper';
import { SubmissionModel } from '../models/Submission';
import { BlackListModel } from '../models/BlackList';
import { UserStateManager } from '../utils/UserStateManager';
import { PendingSubmission } from '../types';

export class SubmissionHandler extends MessageHandler {
  private submissionModel: SubmissionModel;
  private blackListModel: BlackListModel;
  private userStateManager: UserStateManager;

  constructor() {
    super();
    this.submissionModel = new SubmissionModel();
    this.blackListModel = new BlackListModel();
    this.userStateManager = new UserStateManager();
  }

  public async process(message: Message): Promise<void> {
    console.log('📝 SubmissionHandler: 开始处理消息');
    
    if (!this.isValidMessage(message)) {
      console.log('❌ SubmissionHandler: 消息无效');
      return;
    }

    const processed = this.processMessage(message);
    console.log('📊 SubmissionHandler: 消息分析结果:', {
      isPrivate: processed.isPrivate,
      command: processed.command,
      hasText: !!processed.text
    });
    
    // 只处理私聊且非命令的消息
    if (!processed.isPrivate || processed.command) {
      console.log('⏭️ SubmissionHandler: 跳过消息 (不是私聊或者是命令)');
      return;
    }

    console.log('✅ SubmissionHandler: 开始处理投稿');
    const { user, chat } = processed;

    try {
      // 检查用户是否被拉黑
      const isBlocked = await this.blackListModel.isBlocked(user.id);
      if (isBlocked) {
        await bot.sendMessage(chat.id, '❌ 您已被拉黑，无法投稿。');
        return;
      }

      // 检查消息内容
      if (!this.hasValidContent(message)) {
        await bot.sendMessage(chat.id, '❌ 请发送有效的投稿内容（文字、图片、视频等）。');
        return;
      }

      // 创建待确认的投稿
      const pendingSubmission: PendingSubmission = {
        userId: user.id,
        messageId: message.message_id,
        content: this.extractContent(message),
        timestamp: Date.now(),
        originalMessage: message
      };

      // 设置用户状态为等待确认
      console.log('🔄 设置用户状态:', { userId: user.id, state: 'pending_submission' });
      await this.userStateManager.setUserState(user.id, 'pending_submission', pendingSubmission);
      
      // 验证状态是否正确保存
      const savedState = await this.userStateManager.getUserState(user.id);
      console.log('✅ 用户状态已保存:', { userId: user.id, state: savedState?.state, hasData: !!savedState?.data });

      // 发送确认消息给用户
      const confirmationText = `📋 投稿内容预览：

${pendingSubmission.content}

请确认是否提交此投稿：`;

      const keyboard = [
        [
          { text: '✅ 确认投稿', callback_data: callbackVars.SUB_CONFIRM },
          { text: '✏️ 重新编辑', callback_data: callbackVars.SUB_EDIT }
        ],
        [
          { text: '❌ 取消', callback_data: callbackVars.SUB_CANCEL }
        ]
      ];

      await bot.sendMessage(chat.id, confirmationText, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

    } catch (error) {
      console.error('处理投稿时出错:', error);
      await bot.sendMessage(chat.id, '❌ 处理投稿时发生错误，请稍后重试。');
    }
  }

  private hasValidContent(message: Message): boolean {
    return !!(
      message.text ||
      message.photo ||
      message.video ||
      message.document ||
      message.audio ||
      message.voice ||
      message.sticker ||
      message.animation
    );
  }

  private extractContent(message: Message): string {
    if (message.text) {
      return message.text;
    }
    
    if (message.caption) {
      return message.caption;
    }

    // 根据消息类型返回描述
    if (message.photo) return '[图片]';
    if (message.video) return '[视频]';
    if (message.document) return '[文档]';
    if (message.audio) return '[音频]';
    if (message.voice) return '[语音]';
    if (message.sticker) return '[贴纸]';
    if (message.animation) return '[动图]';
    
    return '[多媒体内容]';
  }

  private extractMediaGroup(_message: Message): string[] | undefined {
    // 这里可以实现媒体组处理逻辑
    // 暂时返回 undefined
    return undefined;
  }

  private async forwardToReviewGroup(message: Message, submission: any): Promise<void> {
    const groupId = configManager.group;
    if (!groupId) {
      console.warn('未设置审稿群，无法转发投稿');
      return;
    }

    try {
      // 检查是否是夜间静音时间
      const isNightMode = Helper.isNightMode();
      const timeInfo = isNightMode ? '🌙 夜间投稿' : '📝 新投稿';

      // 创建审稿信息
      const reviewText = `
${timeInfo}

👤 用户: ${submission.userName}
🆔 用户ID: ${submission.userId}
📝 投稿ID: ${submission.id}
📅 时间: ${Helper.formatTimestamp(submission.timestamp)}

内容: ${submission.content}

━━━━━━━━━━━━━━━━━━━
💡 回复此消息使用以下命令：
/ok [评论] - 通过投稿
/no <理由> - 拒绝投稿
/re <内容> - 与用户对话
/ban [理由] - 拉黑用户
      `.trim();

      // 首先发送审稿信息
      await bot.sendMessage(groupId, reviewText);

      // 然后转发原始消息
      await bot.forwardMessage(groupId, message.chat.id, message.message_id);

    } catch (error) {
      console.error('转发到审稿群失败:', error);
    }
  }
} 