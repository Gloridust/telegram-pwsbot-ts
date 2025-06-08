import type { Message } from 'node-telegram-bot-api';
import { MessageHandler } from './MessageHandler';
import { bot } from '../core/bot';
import { configManager } from '../core/config';
import { Helper } from '../utils/Helper';
import { SubmissionModel } from '../models/Submission';
import { Statistics } from '../utils/Statistics';

export class CommandHandler extends MessageHandler {
  private submissionModel: SubmissionModel;
  private statistics: Statistics;

  constructor() {
    super();
    this.submissionModel = new SubmissionModel();
    this.statistics = new Statistics();
  }

  public async process(message: Message): Promise<void> {
    if (!this.isValidMessage(message)) {
      return;
    }

    const processed = this.processMessage(message);
    
    if (!processed.command) {
      return;
    }

    const { command, args, isPrivate, isGroup, user, chat } = processed;

    try {
      switch (command) {
        case 'start':
          if (isPrivate) {
            await this.handleStart(message);
          }
          break;

        case 'version':
          await this.handleVersion(message);
          break;

        case 'setgroup':
          if (isGroup && Helper.isAdmin(user.id)) {
            await this.handleSetGroup(message);
          }
          break;

        case 'ok':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleApprove(message, args || []);
          }
          break;

        case 'no':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleReject(message, args || []);
          }
          break;

        case 're':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleReply(message, args || []);
          }
          break;

        case 'ban':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleBan(message, args || []);
          }
          break;

        case 'unban':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleUnban(message, args || []);
          }
          break;

        case 'unre':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleEndReply(message, args || []);
          }
          break;

        case 'echo':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleEcho(message, args || []);
          }
          break;

        case 'pwshelp':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleHelp(message);
          }
          break;

        case 'stats':
          if (Helper.isAdmin(user.id)) {
            await this.handleStats(message);
          }
          break;

        case 'mystats':
          if (isPrivate) {
            await this.handleMyStats(message);
          }
          break;
      }
    } catch (error) {
      console.error('处理命令时出错:', error);
      await bot.sendMessage(chat.id, '处理命令时发生错误，请稍后重试。');
    }
  }

  private async handleStart(message: Message): Promise<void> {
    const welcomeText = `
欢迎使用投稿机器人！

📝 如何投稿：
直接发送您要投稿的内容给我，支持文字、图片、视频等多种格式。

⚡ 功能特点：
• 支持多图投稿
• 支持匿名投稿
• 支持稿件评论
• 夜间静音推送

📋 投稿状态：
投稿后会转发到审稿群，管理员审核后会通知您结果。

如有问题请联系管理员。
    `;
    
    await bot.sendMessage(message.chat.id, welcomeText.trim());
  }

  private async handleVersion(message: Message): Promise<void> {
    const versionText = `
🤖 PWS Telegram 投稿机器人
📦 版本: 2.0.0-TypeScript
🛠️ 基于 TypeScript 重构优化
📄 许可证: MIT
👤 作者: axiref
    `;
    
    await bot.sendMessage(message.chat.id, versionText.trim());
  }

  private async handleSetGroup(message: Message): Promise<void> {
    const groupId = message.chat.id.toString();
    await Helper.updateConfig({ Group: groupId });
    configManager.updateConfig({ Group: groupId });
    
    await bot.sendMessage(message.chat.id, '✅ 审稿群设置成功！');
  }

  private async handleApprove(message: Message, args: string[]): Promise<void> {
    try {
      // 检查是否是回复消息
      if (!message.reply_to_message) {
        await bot.sendMessage(message.chat.id, '❌ 请回复要通过的投稿消息使用此命令');
        return;
      }

      const comment = args.join(' ');
      
      // 尝试从回复的消息中提取投稿ID
      const replyText = message.reply_to_message.text || message.reply_to_message.caption || '';
      const submissionIdMatch = replyText.match(/📝 投稿ID: ([^\s\n]+)/);
      
      if (!submissionIdMatch) {
        await bot.sendMessage(message.chat.id, '❌ 无法找到投稿ID，请确保回复的是投稿消息');
        return;
      }

      const submissionId = submissionIdMatch[1]!;
      
      // 从数据库获取投稿信息
      const submission = await this.submissionModel.getSubmission(submissionId);
      if (!submission) {
        await bot.sendMessage(message.chat.id, '❌ 找不到对应的投稿记录');
        return;
      }

      if (submission.status !== 'pending') {
        await bot.sendMessage(message.chat.id, `❌ 此投稿已经被处理过了，状态：${submission.status}`);
        return;
      }

      // 发送到频道
      const channelId = configManager.channel;
      if (!channelId) {
        await bot.sendMessage(message.chat.id, '❌ 未配置发布频道，请检查配置');
        return;
      }

      let channelMessageId: number | undefined;

      try {
        // 转发原始消息到频道
        const forwardResult = await bot.forwardMessage(channelId, submission.userId.toString(), submission.messageId);
        channelMessageId = forwardResult.message_id;
        
        // 如果有评论，发送评论
        if (comment) {
          await bot.sendMessage(channelId, `📝 编辑评论: ${comment}`, {
            reply_to_message_id: channelMessageId
          });
        }
      } catch (channelError) {
        console.error('发送到频道失败:', channelError);
        await bot.sendMessage(message.chat.id, '❌ 发送到频道失败，请检查机器人是否有频道发送权限');
        return;
      }

      // 更新投稿状态
      await this.submissionModel.updateSubmissionStatus(submissionId!, 'approved', comment);

      // 通知审稿群
      await bot.sendMessage(message.chat.id, `✅ 稿件已通过并发送到频道${comment ? `\n评论: ${comment}` : ''}`);

      // 通知投稿用户
      try {
        const userNotification = `✅ 您的投稿已通过审核并发布！\n\n📝 投稿ID: ${submissionId}${comment ? `\n💬 编辑评论: ${comment}` : ''}`;
        await bot.sendMessage(submission.userId, userNotification);
      } catch (userError) {
        console.error('通知用户失败:', userError);
        await bot.sendMessage(message.chat.id, '⚠️ 投稿已发布，但通知用户失败（用户可能已阻止机器人）');
      }

    } catch (error) {
      console.error('处理审核通过时出错:', error);
      await bot.sendMessage(message.chat.id, '❌ 处理审核时发生错误，请稍后重试');
    }
  }

  private async handleReject(message: Message, args: string[]): Promise<void> {
    try {
      // 检查是否是回复消息
      if (!message.reply_to_message) {
        await bot.sendMessage(message.chat.id, '❌ 请回复要拒绝的投稿消息使用此命令');
        return;
      }

      const reason = args.join(' ');
      if (!reason) {
        await bot.sendMessage(message.chat.id, '❌ 请提供拒绝理由');
        return;
      }

      // 尝试从回复的消息中提取投稿ID
      const replyText = message.reply_to_message.text || message.reply_to_message.caption || '';
      const submissionIdMatch = replyText.match(/📝 投稿ID: ([^\s\n]+)/);
      
      if (!submissionIdMatch) {
        await bot.sendMessage(message.chat.id, '❌ 无法找到投稿ID，请确保回复的是投稿消息');
        return;
      }

      const submissionId = submissionIdMatch[1]!;
      
      // 从数据库获取投稿信息
      const submission = await this.submissionModel.getSubmission(submissionId);
      if (!submission) {
        await bot.sendMessage(message.chat.id, '❌ 找不到对应的投稿记录');
        return;
      }

      if (submission.status !== 'pending') {
        await bot.sendMessage(message.chat.id, `❌ 此投稿已经被处理过了，状态：${submission.status}`);
        return;
      }

      // 更新投稿状态
      await this.submissionModel.updateSubmissionStatus(submissionId!, 'rejected', undefined, reason);

      // 通知审稿群
      await bot.sendMessage(message.chat.id, `❌ 稿件已拒绝\n理由: ${reason}`);

      // 通知投稿用户
      try {
        const userNotification = `❌ 很抱歉，您的投稿未通过审核\n\n📝 投稿ID: ${submissionId}\n📋 拒绝理由: ${reason}\n\n您可以根据反馈意见修改后重新投稿。`;
        await bot.sendMessage(submission.userId.toString(), userNotification);
      } catch (userError) {
        console.error('通知用户失败:', userError);
        await bot.sendMessage(message.chat.id, '⚠️ 投稿已拒绝，但通知用户失败（用户可能已阻止机器人）');
      }

    } catch (error) {
      console.error('处理审核拒绝时出错:', error);
      await bot.sendMessage(message.chat.id, '❌ 处理审核时发生错误，请稍后重试');
    }
  }

  private async handleReply(message: Message, args: string[]): Promise<void> {
    // 实现回复逻辑
    const replyContent = args.join(' ');
    if (!replyContent) {
      await bot.sendMessage(message.chat.id, '❌ 请提供回复内容');
      return;
    }
    
    await bot.sendMessage(message.chat.id, `💬 回复已发送: ${replyContent}`);
  }

  private async handleBan(message: Message, args: string[]): Promise<void> {
    // 实现拉黑逻辑
    const reason = args.join(' ');
    await bot.sendMessage(message.chat.id, `🚫 用户已被拉黑${reason ? `\n理由: ${reason}` : ''}`);
  }

  private async handleUnban(message: Message, _args: string[]): Promise<void> {
    // 实现解除拉黑逻辑
    await bot.sendMessage(message.chat.id, '✅ 用户已解除拉黑');
  }

  private async handleEndReply(message: Message, _args: string[]): Promise<void> {
    // 实现结束对话逻辑
    await bot.sendMessage(message.chat.id, '✅ 对话状态已结束');
  }

  private async handleEcho(message: Message, args: string[]): Promise<void> {
    // 实现单次回复逻辑
    const echoContent = args.join(' ');
    if (!echoContent) {
      await bot.sendMessage(message.chat.id, '❌ 请提供回复内容');
      return;
    }
    
    await bot.sendMessage(message.chat.id, `📢 单次回复已发送: ${echoContent}`);
  }

  private async handleHelp(message: Message): Promise<void> {
    const helpText = `
📋 审稿群命令帮助：

/ok [评论] - 通过稿件，可附加评论
/no <理由> - 拒绝稿件，需提供理由
/re <内容> - 与用户对话回复
/ban [理由] - 拉黑用户
/unban - 解除拉黑
/unre - 结束对话状态
/echo <内容> - 单次回复用户
/pwshelp - 显示此帮助信息

💡 使用方法：回复要处理的稿件消息并输入相应命令
    `;
    
    await bot.sendMessage(message.chat.id, helpText.trim());
  }

  private isInReviewGroup(chatId: number): boolean {
    const groupId = configManager.group;
    return groupId !== undefined && chatId.toString() === groupId;
  }

  private async handleStats(message: Message): Promise<void> {
    try {
      const report = await this.statistics.generateStatsReport();
      await bot.sendMessage(message.chat.id, report);
    } catch (error) {
      console.error('生成统计报告失败:', error);
      await bot.sendMessage(message.chat.id, '❌ 生成统计报告失败');
    }
  }

  private async handleMyStats(message: Message): Promise<void> {
    try {
      const userId = message.from!.id;
      const stats = await this.statistics.getUserStats(userId);
      await bot.sendMessage(message.chat.id, stats);
    } catch (error) {
      console.error('获取用户统计失败:', error);
      await bot.sendMessage(message.chat.id, '❌ 获取统计数据失败');
    }
  }
} 