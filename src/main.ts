import { bot, initializeBotInfo } from './core/bot';
import { configManager } from './core/config';
import { CommandHandler } from './handlers/CommandHandler';
import type { Message, CallbackQuery } from 'node-telegram-bot-api';

class TelegramPWSBot {
  private commandHandler: CommandHandler;

  constructor() {
    this.commandHandler = new CommandHandler();
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
      await this.commandHandler.process(message);
    } catch (error) {
      console.error('处理消息失败:', error);
    }
  }

  private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
    try {
      // 这里可以添加回调查询处理逻辑
      console.log('收到回调查询:', query.data);
    } catch (error) {
      console.error('处理回调查询失败:', error);
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
      if (process.env.BOT_ENV === 'test') {
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