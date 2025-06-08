import type { CallbackQuery, InlineKeyboardButton } from 'node-telegram-bot-api';
import { bot } from '../core/bot';
import { configManager } from '../core/config';
import { SubmissionModel } from '../models/Submission';
import { BlackListModel } from '../models/BlackList';
import { Helper } from '../utils/Helper';
import { UserStateManager } from '../utils/UserStateManager';

export class CallbackHandler {
  private submissionModel: SubmissionModel;
  private blackListModel: BlackListModel;
  private userStateManager: UserStateManager;

  constructor() {
    this.submissionModel = new SubmissionModel();
    this.blackListModel = new BlackListModel();
    this.userStateManager = new UserStateManager();
  }

  public async process(query: CallbackQuery): Promise<void> {
    try {
      if (!query.data || !query.from || !query.message) {
        return;
      }

      const callbackData = query.data;
      const userId = query.from.id;

      console.log('处理回调查询:', { callbackData, userId });

      // 提取操作类型和数据
      const [action, submissionId] = callbackData.split(':');

      switch (action) {
        case 'confirm':
          if (submissionId === 'submission') {
            await this.handleConfirmSubmission(query);
          }
          break;

        case 'edit':
          if (submissionId === 'submission') {
            await this.handleEditSubmission(query);
          }
          break;

        case 'approve':
          if (submissionId === 'submission') {
            await this.handleApproveMenu(query);
          } else if (submissionId === 'direct') {
            await this.handleDirectApprove(query);
          } else if (submissionId === 'with_comment') {
            await this.handleApproveWithComment(query);
          }
          break;

        case 'reject':
          if (submissionId === 'submission') {
            await this.handleRejectSubmission(query);
          }
          break;

        case 'ban':
          if (submissionId === 'user') {
            await this.handleBanUser(query);
          }
          break;

        case 'reply':
          if (submissionId === 'user') {
            await this.handleReplyUser(query);
          }
          break;

        case 'cancel':
          await this.handleCancel(query);
          break;

        default:
          console.log('未知的回调操作:', action);
      }

      // 应答回调查询
      await bot.answerCallbackQuery(query.id);

    } catch (error) {
      console.error('处理回调查询时出错:', error);
      if (query.id) {
        await bot.answerCallbackQuery(query.id, {
          text: '操作失败，请稍后重试',
          show_alert: true
        });
      }
    }
  }

  private async handleConfirmSubmission(query: CallbackQuery): Promise<void> {
    const userId = query.from!.id;
    console.log('🔍 检查用户状态:', { userId });
    
    const userState = await this.userStateManager.getUserState(userId);
    console.log('📊 用户状态结果:', { 
      userId, 
      hasState: !!userState, 
      state: userState?.state,
      hasData: !!userState?.data 
    });
    
    if (!userState || userState.state !== 'pending_submission') {
      console.error('❌ 用户状态验证失败:', { 
        userId, 
        expected: 'pending_submission', 
        actual: userState?.state 
      });
      
      await bot.answerCallbackQuery(query.id, {
        text: '投稿会话已过期，请重新发送投稿内容',
        show_alert: true
      });
      return;
    }

    const pendingSubmission = userState.data;
    if (!pendingSubmission) {
      await bot.answerCallbackQuery(query.id, {
        text: '找不到待投稿内容',
        show_alert: true
      });
      return;
    }

    // 创建正式投稿
    const submissionId = Helper.generateId();
    const userInfo: { username?: string; first_name?: string; last_name?: string } = {
      first_name: query.from!.first_name
    };
    if (query.from!.username) userInfo.username = query.from!.username;
    if (query.from!.last_name) userInfo.last_name = query.from!.last_name;
    
    const userDisplayName = Helper.getUserDisplayName(userInfo);

    const submission = {
      id: submissionId,
      userId: userId,
      userName: userDisplayName,
      messageId: pendingSubmission.messageId,
      content: pendingSubmission.content,
      timestamp: Date.now(),
      status: 'pending' as const
    };

    await this.submissionModel.createSubmission(submission);

    // 清除用户状态
    await this.userStateManager.clearUserState(userId);

    // 更新确认消息
    await bot.editMessageText(`✅ 投稿已确认提交！

📝 投稿ID: ${submissionId}
📅 提交时间: ${Helper.formatTimestamp(submission.timestamp)}
⏳ 状态: 待审核

您的投稿已转发给管理员审核，请耐心等待审核结果。`, {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id
    });

    // 转发到审稿群
    await this.forwardToReviewGroup(pendingSubmission.originalMessage, submission);
  }

  private async handleEditSubmission(query: CallbackQuery): Promise<void> {
    const userId = query.from!.id;
    
    // 清除用户状态
    await this.userStateManager.clearUserState(userId);

    // 更新消息
    await bot.editMessageText(`✏️ 您已选择重新编辑投稿内容。

请重新发送您要投稿的内容：`, {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id
    });
  }

  private async handleApproveMenu(query: CallbackQuery): Promise<void> {
    const keyboard = [
      [
        { text: '✅ 直接通过', callback_data: 'approve:direct' },
        { text: '💬 添加评论', callback_data: 'approve:with_comment' }
      ],
      [
        { text: '❌ 取消', callback_data: 'cancel:operation' }
      ]
    ];

    await bot.editMessageReplyMarkup({
      inline_keyboard: keyboard
    }, {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id
    });
  }

  private async handleDirectApprove(query: CallbackQuery): Promise<void> {
    await this.processApproval(query, '');
  }

  private async handleApproveWithComment(query: CallbackQuery): Promise<void> {
    const userId = query.from!.id;
    const messageText = query.message!.text || query.message!.caption || '';
    const submissionIdMatch = messageText.match(/📝 投稿ID: ([^\s\n]+)/);
    
    if (!submissionIdMatch) {
      await bot.answerCallbackQuery(query.id, {
        text: '无法找到投稿ID',
        show_alert: true
      });
      return;
    }

    const submissionId = submissionIdMatch[1];

    // 设置用户状态为添加评论
    await this.userStateManager.setUserState(userId, 'adding_comment', {
      submissionId,
      originalMessageId: query.message!.message_id,
      chatId: query.message!.chat.id
    });

    await bot.editMessageText(messageText + '\n\n💬 请发送您的评论内容：', {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ 取消', callback_data: 'cancel:comment' }]
        ]
      }
    });
  }

  private async processApproval(query: CallbackQuery, comment: string): Promise<void> {
    const messageText = query.message!.text || query.message!.caption || '';
    const submissionIdMatch = messageText.match(/📝 投稿ID: ([^\s\n]+)/);
    
    if (!submissionIdMatch || !submissionIdMatch[1]) {
      await bot.answerCallbackQuery(query.id, {
        text: '无法找到投稿ID',
        show_alert: true
      });
      return;
    }

    const submissionId = submissionIdMatch[1];
    const submission = await this.submissionModel.getSubmission(submissionId);
    
    if (!submission) {
      await bot.answerCallbackQuery(query.id, {
        text: '找不到对应的投稿记录',
        show_alert: true
      });
      return;
    }

    if (submission.status !== 'pending') {
      await bot.answerCallbackQuery(query.id, {
        text: `此投稿已经被处理过了，状态：${submission.status}`,
        show_alert: true
      });
      return;
    }

    // 发送到频道
    const channelId = configManager.channel;
    if (!channelId) {
      await bot.answerCallbackQuery(query.id, {
        text: '未配置发布频道，请检查配置',
        show_alert: true
      });
      return;
    }

    try {
      // 转发原始消息到频道
      const forwardResult = await bot.forwardMessage(channelId, submission.userId.toString(), submission.messageId);
      
      // 如果有评论，发送评论
      if (comment) {
        await bot.sendMessage(channelId, `📝 编辑评论: ${comment}`, {
          reply_to_message_id: forwardResult.message_id
        });
      }

      // 更新投稿状态
      await this.submissionModel.updateSubmissionStatus(submissionId, 'approved', comment);

      // 更新审稿群消息
      await bot.editMessageText(messageText + `\n\n✅ 已通过审核并发布到频道${comment ? `\n💬 评论: ${comment}` : ''}`, {
        chat_id: query.message!.chat.id,
        message_id: query.message!.message_id
      });

      // 通知投稿用户
      try {
        const userNotification = `✅ 您的投稿已通过审核并发布！\n\n📝 投稿ID: ${submissionId}${comment ? `\n💬 编辑评论: ${comment}` : ''}`;
        await bot.sendMessage(submission.userId.toString(), userNotification);
      } catch (userError) {
        console.error('通知用户失败:', userError);
      }

    } catch (channelError) {
      console.error('发送到频道失败:', channelError);
      await bot.answerCallbackQuery(query.id, {
        text: '发送到频道失败，请检查机器人权限',
        show_alert: true
      });
    }
  }

  private async handleRejectSubmission(query: CallbackQuery): Promise<void> {
    const messageText = query.message!.text || query.message!.caption || '';
    console.log('🔍 拒绝投稿 - 消息文本:', messageText);
    
    const submissionIdMatch = messageText.match(/📝 投稿ID: ([^\s\n]+)/);
    console.log('🔍 拒绝投稿 - 匹配结果:', submissionIdMatch);
    
    if (!submissionIdMatch || !submissionIdMatch[1]) {
      await bot.answerCallbackQuery(query.id, {
        text: '无法找到投稿ID',
        show_alert: true
      });
      return;
    }

    const submissionId = submissionIdMatch[1];
    console.log('📝 拒绝投稿 - 投稿ID:', submissionId);
    
    try {
      // 获取投稿信息
      const submission = await this.submissionModel.getSubmission(submissionId);
      console.log('📊 拒绝投稿 - 投稿信息:', submission);
      
      if (!submission || submission.status !== 'pending') {
        console.error('❌ 投稿状态异常:', { 
          found: !!submission, 
          status: submission?.status,
          expectedStatus: 'pending'
        });
        await bot.answerCallbackQuery(query.id, {
          text: '投稿状态异常，无法处理',
          show_alert: true
        });
        return;
      }

      // 更新投稿状态
      await this.submissionModel.updateSubmissionStatus(submissionId, 'rejected', undefined, '');

      // 更新审稿群消息
      await bot.editMessageText(messageText + '\n\n❌ 已拒绝投稿', {
        chat_id: query.message!.chat.id,
        message_id: query.message!.message_id
      });

      // 通知用户
      try {
        const userNotification = `❌ 很抱歉，您的投稿未通过审核\n\n📝 投稿ID: ${submissionId}`;
        await bot.sendMessage(submission.userId.toString(), userNotification);
      } catch (userError) {
        console.error('通知用户失败:', userError);
      }
      
      await bot.answerCallbackQuery(query.id, {
        text: '投稿已拒绝',
        show_alert: false
      });
      
    } catch (error) {
      console.error('拒绝投稿失败:', error);
      await bot.answerCallbackQuery(query.id, {
        text: '拒绝操作失败',
        show_alert: true
      });
    }
  }

  private async handleBanUser(query: CallbackQuery): Promise<void> {
    const messageText = query.message!.text || query.message!.caption || '';
    const userIdMatch = messageText.match(/🆔 用户ID: (\d+)/);
    const submissionIdMatch = messageText.match(/📝 投稿ID: ([^\s\n]+)/);
    
    if (!userIdMatch || !userIdMatch[1] || !submissionIdMatch || !submissionIdMatch[1]) {
      await bot.answerCallbackQuery(query.id, {
        text: '无法找到用户信息',
        show_alert: true
      });
      return;
    }

    const targetUserId = parseInt(userIdMatch[1]!);
    const submissionId = submissionIdMatch[1]!;

    try {
      // 拉黑用户
      await this.blackListModel.blockUser(targetUserId, '违规投稿被拉黑');
      
      // 更新投稿状态为拒绝
      await this.submissionModel.updateSubmissionStatus(submissionId, 'rejected', undefined, '用户已被拉黑');

      // 更新审稿群消息
      await bot.editMessageText(messageText + '\n\n🚫 用户已被拉黑', {
        chat_id: query.message!.chat.id,
        message_id: query.message!.message_id
      });

      // 通知投稿用户
      try {
        const userNotification = `🚫 您已被拉黑，无法继续使用投稿功能。\n\n如有疑问，请联系管理员。`;
        await bot.sendMessage(targetUserId.toString(), userNotification);
      } catch (userError) {
        console.error('通知被拉黑用户失败:', userError);
      }

      await bot.answerCallbackQuery(query.id, {
        text: '用户已被拉黑',
        show_alert: false
      });

    } catch (error) {
      console.error('拉黑用户失败:', error);
      await bot.answerCallbackQuery(query.id, {
        text: '拉黑操作失败',
        show_alert: true
      });
    }
  }

  private async handleReplyUser(query: CallbackQuery): Promise<void> {
    const messageText = query.message!.text || query.message!.caption || '';
    const userIdMatch = messageText.match(/🆔 用户ID: (\d+)/);
    const submissionIdMatch = messageText.match(/📝 投稿ID: ([^\s\n]+)/);
    
    if (!userIdMatch || !submissionIdMatch) {
      await bot.answerCallbackQuery(query.id, {
        text: '无法找到用户信息',
        show_alert: true
      });
      return;
    }

    const targetUserId = parseInt(userIdMatch[1]!);
    const submissionId = submissionIdMatch[1]!;
    const adminId = query.from!.id;

    console.log('🎯 handleReplyUser - 提取的数据:', { 
      targetUserId, 
      submissionId, 
      adminId,
      messageText: messageText.substring(0, 100) + '...'
    });

    // 设置管理员状态为回复模式
    const stateData = {
      targetUserId,
      submissionId,
      originalMessageId: query.message!.message_id,
      chatId: query.message!.chat.id,
      action: 'reply'
    };
    
    console.log('💾 准备保存状态:', stateData);
    await this.userStateManager.setUserState(adminId, 'adding_comment', stateData);
    
    // 验证状态是否保存成功
    const savedState = await this.userStateManager.getUserState(adminId);
    console.log('✅ 状态保存验证:', { 
      saved: !!savedState, 
      savedData: savedState?.data 
    });

    await bot.editMessageText(messageText + '\n\n💬 请发送您要回复给用户的内容：', {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ 取消', callback_data: 'cancel:comment' }]
        ]
      }
    });

    await bot.answerCallbackQuery(query.id, {
      text: '请发送回复内容',
      show_alert: false
    });
  }

  private async handleCancel(query: CallbackQuery): Promise<void> {
    const userId = query.from!.id;
    await this.userStateManager.clearUserState(userId);

    const messageText = query.message!.text || query.message!.caption || '';
    const firstSplit = messageText.split('\n\n💬 请发送')[0];
    const cleanText = firstSplit?.split('\n\n❌ 请发送')[0] || messageText;

    // 恢复原始审稿消息和按钮
    const keyboard = this.createReviewKeyboard();
    
    await bot.editMessageText(cleanText, {
      chat_id: query.message!.chat.id,
      message_id: query.message!.message_id,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  private createReviewKeyboard(): InlineKeyboardButton[][] {
    return [
      [
        { text: '✅ 通过', callback_data: 'approve:submission' },
        { text: '❌ 拒绝', callback_data: 'reject:submission' }
      ],
      [
        { text: '🚫 拉黑', callback_data: 'ban:user' },
        { text: '💬 回复', callback_data: 'reply:user' }
      ]
    ];
  }

  private async forwardToReviewGroup(originalMessage: any, submission: any): Promise<void> {
    const groupId = configManager.group;
    if (!groupId) {
      console.warn('未设置审稿群，无法转发投稿');
      return;
    }

    try {
      const isNightMode = Helper.isNightMode();
      const timeInfo = isNightMode ? '🌙 夜间投稿' : '📝 新投稿';

      const reviewText = `${timeInfo}

👤 用户: ${submission.userName}
🆔 用户ID: ${submission.userId}
📝 投稿ID: ${submission.id}
📅 时间: ${Helper.formatTimestamp(submission.timestamp)}

内容: ${submission.content}`;

      const keyboard = this.createReviewKeyboard();

      // 发送审稿信息带按钮
      await bot.sendMessage(groupId, reviewText, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      // 转发原始消息
      await bot.forwardMessage(groupId, originalMessage.chat.id, originalMessage.message_id);

    } catch (error) {
      console.error('转发到审稿群失败:', error);
    }
  }

  public async handleCommentInput(message: any): Promise<boolean> {
    const userId = message.from.id;
    const messageChatId = message.chat.id;
    console.log('📝 handleCommentInput 检查用户状态:', { 
      userId, 
      messageChatId,
      chatType: message.chat.type 
    });
    
    const userState = await this.userStateManager.getUserState(userId);
    console.log('📊 用户状态:', { 
      hasState: !!userState, 
      state: userState?.state,
      data: userState?.data 
    });
    
    if (!userState || userState.state !== 'adding_comment') {
      return false;
    }

    // 验证消息是否来自正确的聊天
    if (userState.data.chatId && messageChatId !== userState.data.chatId) {
      console.log('⚠️ 消息来源不匹配:', { 
        expectedChatId: userState.data.chatId, 
        actualChatId: messageChatId 
      });
      return false;
    }

    const comment = message.text;
    if (!comment) {
      await bot.sendMessage(message.chat.id, '❌ 请发送文字评论');
      return true;
    }

    const { submissionId, originalMessageId, chatId, action, targetUserId } = userState.data;
    console.log('🔍 提取的状态数据:', { 
      submissionId, 
      originalMessageId, 
      chatId, 
      action, 
      targetUserId 
    });

    if (action === 'reply') {
      // 处理回复用户
      console.log('➡️ 调用 processReplyToUser:', { targetUserId, comment });
      await this.processReplyToUser(targetUserId, comment, submissionId, chatId, originalMessageId);
    } else {
      // 处理通过评论
      await this.processApprovalWithComment(submissionId, comment, chatId, originalMessageId);
    }

    // 清除用户状态
    await this.userStateManager.clearUserState(userId);
    
    // 删除用户的评论消息
    try {
      await bot.deleteMessage(message.chat.id, message.message_id);
    } catch (error) {
      console.error('删除消息失败:', error);
    }

    return true;
  }

  private async processApprovalWithComment(submissionId: string, comment: string, chatId: number, messageId: number): Promise<void> {
    const submission = await this.submissionModel.getSubmission(submissionId);
    
    if (!submission || submission.status !== 'pending') {
      await bot.sendMessage(chatId, '❌ 投稿状态异常，无法处理');
      return;
    }

    // 发送到频道
    const channelId = configManager.channel;
    if (!channelId) {
      await bot.sendMessage(chatId, '❌ 未配置发布频道');
      return;
    }

    try {
      const forwardResult = await bot.forwardMessage(channelId, submission.userId, submission.messageId);
      
      await bot.sendMessage(channelId, `📝 编辑评论: ${comment}`, {
        reply_to_message_id: forwardResult.message_id
      });

      await this.submissionModel.updateSubmissionStatus(submissionId, 'approved', comment);

      const originalText = (await bot.getChat(chatId)).description || '';
      await bot.editMessageText(originalText + `\n\n✅ 已通过审核并发布到频道\n💬 评论: ${comment}`, {
        chat_id: chatId,
        message_id: messageId
      });

      // 通知用户
      try {
        const userNotification = `✅ 您的投稿已通过审核并发布！\n\n📝 投稿ID: ${submissionId}\n💬 编辑评论: ${comment}`;
        await bot.sendMessage(submission.userId.toString(), userNotification);
      } catch (error) {
        console.error('通知用户失败:', error);
      }

    } catch (error) {
      console.error('处理审核通过失败:', error);
      await bot.sendMessage(chatId, '❌ 发送到频道失败');
    }
  }



  private async processReplyToUser(targetUserId: number, replyContent: string, submissionId: string, chatId: number, messageId: number): Promise<void> {
    console.log('🔄 processReplyToUser 开始:', { targetUserId, replyContent, submissionId, chatId, messageId });
    
    try {
      // 发送回复给用户
      const userMessage = `💬 管理员回复：

${replyContent}

投稿ID: ${submissionId}`;
      
      console.log('📤 准备发送消息给用户:', { targetUserId: targetUserId.toString(), userMessage });
      const sendResult = await bot.sendMessage(targetUserId.toString(), userMessage);
      console.log('✅ 消息发送成功:', { messageId: sendResult.message_id });

      // 更新审稿群消息
      try {
        // 由于无法直接获取消息内容，我们重新构建消息文本
        const reviewText = `💬 已回复用户: ${replyContent}

投稿ID: ${submissionId}`;
        
        await bot.editMessageText(reviewText, {
          chat_id: chatId,
          message_id: messageId
        });
        console.log('✅ 审稿群消息已更新');
      } catch (editError) {
        console.error('更新审稿群消息失败:', editError);
        // 如果编辑失败，发送新消息
        await bot.sendMessage(chatId, `💬 已回复用户: ${replyContent}\n投稿ID: ${submissionId}`);
      }

      console.log(`✅ 已回复用户 ${targetUserId}: ${replyContent}`);

    } catch (error) {
      console.error('❌ 回复用户失败:', error);
      console.error('错误详情:', {
        errorMessage: error instanceof Error ? error.message : '未知错误',
        targetUserId,
        chatId
      });
      await bot.sendMessage(chatId, `❌ 回复用户失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
} 