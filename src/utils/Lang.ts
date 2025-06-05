import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { LangConfig, CallbackVars } from '../types';

export class LangManager {
  private langData: LangConfig = {};
  private variables: CallbackVars;
  private currentLang: string;

  constructor(lang: string = 'zh-CN', variables: CallbackVars) {
    this.currentLang = lang;
    this.variables = variables;
    this.loadLanguage(lang);
  }

  private loadLanguage(lang: string): void {
    const langPath = join(__dirname, '../../lang', `${lang}.json`);
    
    if (!existsSync(langPath)) {
      console.warn(`语言文件不存在: ${langPath}，使用默认语言 zh-CN`);
      this.loadLanguage('zh-CN');
      return;
    }

    try {
      const content = readFileSync(langPath, 'utf-8');
      this.langData = JSON.parse(content) as LangConfig;
      console.log(`已加载语言: ${lang}`);
    } catch (error) {
      console.error(`加载语言文件失败: ${error}`);
      if (lang !== 'zh-CN') {
        this.loadLanguage('zh-CN');
      }
    }
  }

  public get(key: string, replacements: Record<string, string> = {}): string {
    let text = this.langData[key] || key;

    // 替换变量
    for (const [varKey, varValue] of Object.entries(this.variables)) {
      text = text.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue);
    }

    // 替换自定义参数
    for (const [replaceKey, replaceValue] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`{{${replaceKey}}}`, 'g'), replaceValue);
    }

    return text;
  }

  public has(key: string): boolean {
    return key in this.langData;
  }

  public switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.loadLanguage(lang);
  }

  public getCurrentLanguage(): string {
    return this.currentLang;
  }

  public getAvailableLanguages(): string[] {
    // 这里可以扫描 lang 目录来获取可用语言
    return ['zh-CN', 'zh-TW'];
  }

  // 格式化消息的便捷方法
  public format(key: string, ...args: (string | number)[]): string {
    let text = this.get(key);
    
    // 支持 {0}, {1}, {2} 等占位符
    args.forEach((arg, index) => {
      text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
    });

    return text;
  }
}