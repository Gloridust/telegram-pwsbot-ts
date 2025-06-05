import dotenv from 'dotenv';
import { BotConfig } from '../types';

// 加载环境变量
const result = dotenv.config();

export class ConfigManager {
  private config: BotConfig;

  constructor() {
    if (!result.parsed) {
      throw new Error('不存在 .env 配置，请确保将项目目录下具有 .env 配置文件！(配置文件模板：env.example)');
    }

    // 验证必需的配置项
    const parsed = result.parsed;
    if (!parsed['Token'] || !parsed['Admin'] || !parsed['Channel']) {
      throw new Error('缺少必需的配置项：Token、Admin 或 Channel');
    }

    this.config = parsed as unknown as BotConfig;
    this.validateConfig();
    this.setupTimezone();
  }

  private validateConfig(): void {
    if (!this.config.Token) {
      throw new Error('.env 配置文件中不存在Token，请确保正确填写！');
    }
    if (!this.config.Admin) {
      throw new Error('.env 配置文件中不存在Admin，请确保正确填写！');
    }
    if (!this.config.Channel) {
      throw new Error('.env 配置文件中不存在Channel，请确保正确填写！');
    }
  }

  private setupTimezone(): void {
    if (this.config.AutoMute) {
      process.env.TZ = this.config.AutoMute;
    }
  }

  public getConfig(): BotConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public get token(): string {
    return this.config.Token;
  }

  public get admin(): string {
    return this.config.Admin;
  }

  public get channel(): string {
    return this.config.Channel;
  }

  public get group(): string | undefined {
    return this.config.Group;
  }

  public get lang(): string {
    return this.config.Lang || 'zh-CN';
  }

  public get autoMute(): string | undefined {
    return this.config.AutoMute;
  }
}

export const configManager = new ConfigManager();