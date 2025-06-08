import type { Message } from 'node-telegram-bot-api';
import { MessageHandler } from './MessageHandler';
import { bot, callbackVars } from '../core/bot';
import { BlackListModel } from '../models/BlackList';
import { UserStateManager } from '../utils/UserStateManager';
import { PendingSubmission } from '../types';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';
import { Validator } from '../utils/Validator';

export class SubmissionHandler extends MessageHandler {
  private blackListModel: BlackListModel;
  private userStateManager: UserStateManager;

  constructor() {
    super();
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

      // 提取并验证内容
      const content = this.extractContent(message);
      
      // 验证文本内容
      if (message.text || message.caption) {
        const textToValidate = message.text || message.caption || '';
        const validation = Validator.validateSubmissionText(textToValidate);
        
        if (!validation.valid) {
          await bot.sendMessage(chat.id, `❌ ${validation.error}`);
          return;
        }
      }

      // 验证媒体文件大小
      if (message.photo || message.video || message.document) {
        const fileSize = this.getFileSize(message);
        if (fileSize) {
          const sizeValidation = Validator.validateFileSize(fileSize);
          if (!sizeValidation.valid) {
            await bot.sendMessage(chat.id, `❌ ${sizeValidation.error}`);
            return;
          }
        }
      }

      // 创建待确认的投稿
      const pendingSubmission: PendingSubmission = {
        userId: user.id,
        messageId: message.message_id,
        content: Validator.sanitizeInput(content),
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
      await ErrorHandler.handle(error, {
        userId: user.id,
        chatId: chat.id,
        action: 'submission_process',
        type: ErrorType.UNKNOWN
      });
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



  private getFileSize(message: Message): number | undefined {
    if (message.photo && message.photo.length > 0) {
      // 获取最大尺寸的图片
      const largestPhoto = message.photo[message.photo.length - 1];
      return largestPhoto?.file_size;
    }
    
    if (message.video) {
      return message.video.file_size;
    }
    
    if (message.document) {
      return message.document.file_size;
    }
    
    if (message.audio) {
      return message.audio.file_size;
    }
    
    if (message.voice) {
      return message.voice.file_size;
    }
    
    return undefined;
  }


} 