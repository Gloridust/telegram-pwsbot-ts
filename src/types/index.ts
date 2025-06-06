import type { Message as TelegramMessage, User, Chat } from 'node-telegram-bot-api';

export interface BotConfig {
  Token: string;
  Admin: string;
  Channel: string;
  AutoMute?: string;
  Group?: string;
  BotID?: number;
  BotUserName?: string;
  Lang?: string;
}

export interface SubmissionData {
  id: string;
  userId: number;
  userName?: string;
  messageId: number;
  content: string;
  mediaGroup?: string[];
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  reason?: string;
}

export interface UserData {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isBlocked: boolean;
  submissions: string[];
  lastActivity: number;
}

export interface ReplySession {
  userId: number;
  adminId: number;
  isActive: boolean;
  startTime: number;
}

export interface CallbackVars {
  REC_ANY: string;
  REC_REAL: string;
  SUB_ANY: string;
  SUB_REAL: string;
  SUB_CANCEL: string;
  SUB_CONFIRM: string;
  SUB_EDIT: string;
  APPROVE: string;
  APPROVE_WITH_COMMENT: string;
  REJECT: string;
  BAN_USER: string;
  REPLY_USER: string;
  BOT_NOAUTH_KICK: string;
  BOT_NOAUTH: string;
  BOT_BLOCK: string;
}

export interface LangConfig {
  [key: string]: string;
}

export interface DatabaseItem {
  id: string;
  data: any;
  timestamp: number;
}

export interface ProcessedMessage {
  message: TelegramMessage;
  user: User;
  chat: Chat;
  isPrivate: boolean;
  isGroup: boolean;
  isChannel: boolean;
  text?: string;
  command?: string;
  args?: string[];
}

export interface PendingSubmission {
  userId: number;
  messageId: number;
  content: string;
  timestamp: number;
  originalMessage: TelegramMessage;
}

export interface UserState {
  userId: number;
  state: 'normal' | 'pending_submission' | 'adding_comment';
  data?: any;
  timestamp: number;
} 