import { bot, initializeBotInfo } from './core/bot';
import { configManager } from './core/config';
import { CommandHandler } from './handlers/CommandHandler';
import { SubmissionHandler } from './handlers/SubmissionHandler';
import { CallbackHandler } from './handlers/CallbackHandler';
import type { Message, CallbackQuery } from 'node-telegram-bot-api';

class TelegramPWSBot {
  private commandHandler: CommandHandler;
  private submissionHandler: SubmissionHandler;
  private callbackHandler: CallbackHandler;

  constructor() {
    this.commandHandler = new CommandHandler();
    this.submissionHandler = new SubmissionHandler();
    this.callbackHandler = new CallbackHandler();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 消息处理器
    bot.on('message', (message: Message) => {
      this.handleMessage(message).catch(error => {
        console.error('处理消息时出错:', error);
      });
    });

    // 回调查询处理器
    bot.on('callback_query', (query: CallbackQuery) => {
      this.handleCallbackQuery(query).catch(error => {
        console.error('处理回调查询时出错:', error);
      });
    });

    // 错误处理器
    bot.on('polling_error', (error: Error) => {
      console.error('轮询错误:', error);
      // 这里可以添加重启逻辑或错误报告
    });

    // 优雅关闭处理
    process.on('SIGINT', () => {
      console.log('收到 SIGINT 信号，正在关闭机器人...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM 信号，正在关闭机器人...');
      this.shutdown();
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      console.log('📨 收到消息:', {
        messageId: message.message_id,
        fromId: message.from?.id,
        chatType: message.chat.type,
        text: message.text?.substring(0, 50) + (message.text && message.text.length > 50 ? '...' : ''),
        hasPhoto: !!message.photo,
        hasVideo: !!message.video
      });
      
      // 首先检查是否是回调处理器需要处理的评论输入
      const commentHandled = await this.callbackHandler.handleCommentInput(message);
      if (commentHandled) {
        console.log('✅ 评论输入处理完成');
        return;
      }
      
      // 然后尝试命令处理器（处理以 / 开头的命令）
      console.log('🔄 尝试命令处理器...');
      await this.commandHandler.process(message);
      
      // 最后尝试投稿处理器（处理私聊中的非命令消息）
      console.log('🔄 尝试投稿处理器...');
      await this.submissionHandler.process(message);
      
      console.log('✅ 消息处理完成');
    } catch (error) {
      console.error('❌ 处理消息失败:', error);
    }
  }

  private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
    try {
      console.log('📞 收到回调查询:', {
        queryId: query.id,
        fromId: query.from?.id,
        data: query.data,
        messageId: query.message?.message_id
      });
      
      await this.callbackHandler.process(query);
      
      console.log('✅ 回调查询处理完成');
    } catch (error) {
      console.error('❌ 处理回调查询失败:', error);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      console.log('正在停止机器人...');
      await bot.stopPolling();
      console.log('机器人已停止');
      process.exit(0);
    } catch (error) {
      console.error('关闭机器人时出错:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      console.log('正在启动 Telegram PWS 机器人...');
      
      // 初始化机器人信息
      await initializeBotInfo();
      
      console.log('机器人配置:');
      console.log(`- 频道: ${configManager.channel}`);
      console.log(`- 管理员: ${configManager.admin}`);
      console.log(`- 语言: ${configManager.lang}`);
      console.log(`- 夜间静音: ${configManager.autoMute || '禁用'}`);
      
      console.log('✅ 机器人启动成功，正在监听消息...');
      
      // 测试环境自动退出
      if (process.env['BOT_ENV'] === 'test') {
        setTimeout(() => {
          console.log('测试环境，3秒后自动退出...');
          process.exit(0);
        }, 3000);
      }
      
    } catch (error) {
      console.error('启动机器人失败:', error);
      process.exit(1);
    }
  }
}

// 启动机器人
const pwsBot = new TelegramPWSBot();
pwsBot.start().catch(error => {
  console.error('启动失败:', error);
  process.exit(1);
}); 