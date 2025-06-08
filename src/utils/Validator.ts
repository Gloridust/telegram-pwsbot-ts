export class Validator {
  // 投稿内容限制
  private static readonly MAX_TEXT_LENGTH = 4096;
  private static readonly MIN_TEXT_LENGTH = 1;
  private static readonly MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB
  
  // 命令参数限制
  private static readonly MAX_COMMENT_LENGTH = 1000;
  private static readonly MAX_REASON_LENGTH = 500;
  
  // ID格式验证
  private static readonly USER_ID_PATTERN = /^\d+$/;
  private static readonly SUBMISSION_ID_PATTERN = /^[0-9]+_[a-z0-9]+$/;
  private static readonly CHANNEL_ID_PATTERN = /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

  /**
   * 验证投稿文本内容
   */
  public static validateSubmissionText(text: string): { valid: boolean; error?: string } {
    if (!text || text.trim().length < this.MIN_TEXT_LENGTH) {
      return { valid: false, error: '投稿内容不能为空' };
    }
    
    if (text.length > this.MAX_TEXT_LENGTH) {
      return { valid: false, error: `投稿内容过长，最多支持 ${this.MAX_TEXT_LENGTH} 个字符` };
    }
    
    // 检查是否包含敏感内容（可扩展）
    if (this.containsSensitiveContent(text)) {
      return { valid: false, error: '投稿内容包含敏感信息' };
    }
    
    return { valid: true };
  }

  /**
   * 验证评论内容
   */
  public static validateComment(comment: string): { valid: boolean; error?: string } {
    if (!comment || comment.trim().length === 0) {
      return { valid: false, error: '评论内容不能为空' };
    }
    
    if (comment.length > this.MAX_COMMENT_LENGTH) {
      return { valid: false, error: `评论过长，最多支持 ${this.MAX_COMMENT_LENGTH} 个字符` };
    }
    
    return { valid: true };
  }

  /**
   * 验证拒绝理由
   */
  public static validateReason(reason: string): { valid: boolean; error?: string } {
    if (!reason || reason.trim().length === 0) {
      return { valid: false, error: '拒绝理由不能为空' };
    }
    
    if (reason.length > this.MAX_REASON_LENGTH) {
      return { valid: false, error: `理由过长，最多支持 ${this.MAX_REASON_LENGTH} 个字符` };
    }
    
    return { valid: true };
  }

  /**
   * 验证用户ID
   */
  public static validateUserId(userId: string | number): boolean {
    const id = String(userId);
    return this.USER_ID_PATTERN.test(id) && Number(id) > 0;
  }

  /**
   * 验证投稿ID格式
   */
  public static validateSubmissionId(submissionId: string): boolean {
    return this.SUBMISSION_ID_PATTERN.test(submissionId);
  }

  /**
   * 验证频道ID格式
   */
  public static validateChannelId(channelId: string): boolean {
    return this.CHANNEL_ID_PATTERN.test(channelId) || /^-?\d+$/.test(channelId);
  }

  /**
   * 验证文件大小
   */
  public static validateFileSize(size: number): { valid: boolean; error?: string } {
    if (size > this.MAX_MEDIA_SIZE) {
      return { 
        valid: false, 
        error: `文件过大，最大支持 ${this.MAX_MEDIA_SIZE / 1024 / 1024}MB` 
      };
    }
    return { valid: true };
  }

  /**
   * 验证命令参数
   */
  public static validateCommandArgs(command: string, args: string[]): { valid: boolean; error?: string } {
    switch (command) {
      case 'no':
        if (args.length === 0) {
          return { valid: false, error: '请提供拒绝理由' };
        }
        return this.validateReason(args.join(' '));
      
      case 're':
      case 'echo':
        if (args.length === 0) {
          return { valid: false, error: '请提供回复内容' };
        }
        return { valid: true };
      
      default:
        return { valid: true };
    }
  }

  /**
   * 清理和规范化输入
   */
  public static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/\s+/g, ' ') // 多个空格替换为单个
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // 移除零宽字符
  }

  /**
   * 检查敏感内容（可根据需求扩展）
   */
  private static containsSensitiveContent(text: string): boolean {
    // 这里可以添加敏感词检测逻辑
    // 例如：政治敏感词、广告链接、恶意代码等
    const sensitivePatterns = [
      /bit\.ly|tinyurl\.com|short\.link/i, // 短链接
      /<script[\s\S]*?<\/script>/gi, // 脚本标签
      /javascript:/gi, // JavaScript协议
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * 验证时间戳
   */
  public static isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const oneHourFromNow = now + 60 * 60 * 1000;
    
    return timestamp > oneYearAgo && timestamp < oneHourFromNow;
  }

  /**
   * 格式化用户输入的HTML（防止注入）
   */
  public static escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'\/]/g, (s) => htmlEntities[s] || s);
  }
} 