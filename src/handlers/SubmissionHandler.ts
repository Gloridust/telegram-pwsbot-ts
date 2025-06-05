import type { Message } from 'node-telegram-bot-api';
import { MessageHandler } from './MessageHandler';
import { bot } from '../core/bot';
import { configManager } from '../core/config';
import { Helper } from '../utils/Helper';
import { SubmissionModel } from '../models/Submission';
import { BlackListModel } from '../models/BlackList';

export class SubmissionHandler extends MessageHandler {
  private submissionModel: SubmissionModel;
  private blackListModel: BlackListModel;

  constructor() {
    super();
    this.submissionModel = new SubmissionModel();
    this.blackListModel = new BlackListModel();
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

      // 创建投稿
      const submissionId = Helper.generateId();
      
      // 安全地构建用户显示名称参数
      const userInfo: { username?: string; first_name?: string; last_name?: string } = {
        first_name: user.first_name
      };
      
      if (user.username) {
        userInfo.username = user.username;
      }
      
      if (user.last_name) {
        userInfo.last_name = user.last_name;
      }
      
      const userDisplayName = Helper.getUserDisplayName(userInfo);
      
      const submission = {
        id: submissionId,
        userId: user.id,
        userName: userDisplayName,
        messageId: message.message_id,
        content: this.extractContent(message),
        timestamp: Date.now(),
        status: 'pending' as const
      };

      // 只有在有媒体组时才添加 mediaGroup 属性
      const mediaGroup = this.extractMediaGroup(message);
      if (mediaGroup) {
        (submission as any).mediaGroup = mediaGroup;
      }

      await this.submissionModel.createSubmission(submission);

      // 发送确认消息给用户
      await bot.sendMessage(chat.id, `
✅ 投稿已收到！

📝 投稿ID: ${submissionId}
📅 提交时间: ${Helper.formatTimestamp(submission.timestamp)}
⏳ 状态: 待审核

您的投稿已转发给管理员审核，请耐心等待审核结果。
      `.trim());

      // 转发到审稿群
      await this.forwardToReviewGroup(message, submission);

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