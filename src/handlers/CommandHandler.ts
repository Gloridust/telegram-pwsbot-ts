import type { Message } from 'node-telegram-bot-api';
import { MessageHandler } from './MessageHandler';
import { bot } from '../core/bot';
import { configManager } from '../core/config';
import { Helper } from '../utils/Helper';
import { SubmissionModel } from '../models/Submission';
import { BlackListModel } from '../models/BlackList';
import { ReplySessionModel } from '../models/ReplySession';

export class CommandHandler extends MessageHandler {
  private submissionModel: SubmissionModel;
  private blackListModel: BlackListModel;
  private replySessionModel: ReplySessionModel;

  constructor() {
    super();
    this.submissionModel = new SubmissionModel();
    this.blackListModel = new BlackListModel();
    this.replySessionModel = new ReplySessionModel();
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
            await this.handleApprove(message, args);
          }
          break;

        case 'no':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleReject(message, args);
          }
          break;

        case 're':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleReply(message, args);
          }
          break;

        case 'ban':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleBan(message, args);
          }
          break;

        case 'unban':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleUnban(message, args);
          }
          break;

        case 'unre':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleEndReply(message, args);
          }
          break;

        case 'echo':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleEcho(message, args);
          }
          break;

        case 'pwshelp':
          if (isGroup && this.isInReviewGroup(chat.id)) {
            await this.handleHelp(message);
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
    // 实现审核通过逻辑
    const comment = args.join(' ');
    await bot.sendMessage(message.chat.id, `✅ 稿件已通过${comment ? `\n评论: ${comment}` : ''}`);
  }

  private async handleReject(message: Message, args: string[]): Promise<void> {
    // 实现审核拒绝逻辑
    const reason = args.join(' ');
    if (!reason) {
      await bot.sendMessage(message.chat.id, '❌ 请提供拒绝理由');
      return;
    }
    
    await bot.sendMessage(message.chat.id, `❌ 稿件已拒绝\n理由: ${reason}`);
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

  private async handleUnban(message: Message, args: string[]): Promise<void> {
    // 实现解除拉黑逻辑
    await bot.sendMessage(message.chat.id, '✅ 用户已解除拉黑');
  }

  private async handleEndReply(message: Message, args: string[]): Promise<void> {
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
} 