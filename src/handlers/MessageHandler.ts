import type { Message } from 'node-telegram-bot-api';
import { ProcessedMessage } from '../types';
import { Helper } from '../utils/Helper';

export abstract class MessageHandler {
  protected processMessage(message: Message): ProcessedMessage {
    const user = message.from!;
    const chat = message.chat;
    
    return {
      message,
      user,
      chat,
      isPrivate: chat.type === 'private',
      isGroup: chat.type === 'group' || chat.type === 'supergroup',
      isChannel: chat.type === 'channel',
      text: message.text,
      command: this.extractCommand(message.text),
      args: this.extractArgs(message.text)
    };
  }

  private extractCommand(text?: string): string | undefined {
    if (!text || !text.startsWith('/')) {
      return undefined;
    }
    
    const match = text.match(/^\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : undefined;
  }

  private extractArgs(text?: string): string[] | undefined {
    if (!text || !text.startsWith('/')) {
      return undefined;
    }
    
    const parts = text.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1) : [];
  }

  protected getUserDisplayName(user: { 
    username?: string; 
    first_name?: string; 
    last_name?: string; 
  }): string {
    return Helper.getUserDisplayName(user);
  }

  protected isValidMessage(message: Message): boolean {
    return !!(message.from && message.chat);
  }

  public abstract process(message: Message): Promise<void>;
} 