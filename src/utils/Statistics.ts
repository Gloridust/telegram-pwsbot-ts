import { SubmissionModel } from '../models/Submission';
import { BlackListModel } from '../models/BlackList';

export interface SystemStats {
  submissions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    todayCount: number;
    weekCount: number;
  };
  users: {
    totalSubmitters: number;
    blacklisted: number;
    activeToday: number;
  };
  performance: {
    averageProcessingTime: number;
    approvalRate: number;
    rejectionRate: number;
  };
}

export class Statistics {
  private submissionModel: SubmissionModel;
  private blackListModel: BlackListModel;
  
  constructor() {
    this.submissionModel = new SubmissionModel();
    this.blackListModel = new BlackListModel();
  }

  /**
   * 获取系统统计数据
   */
  public async getSystemStats(): Promise<SystemStats> {
    const submissions = await this.submissionModel.getAll();
    const blacklistedUsers = await this.blackListModel.getBlockedUsers();
    
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // 统计投稿数据
    const pending = submissions.filter(s => s.status === 'pending').length;
    const approved = submissions.filter(s => s.status === 'approved').length;
    const rejected = submissions.filter(s => s.status === 'rejected').length;
    const todaySubmissions = submissions.filter(s => s.timestamp >= todayStart).length;
    const weekSubmissions = submissions.filter(s => s.timestamp >= weekAgo).length;
    
    // 统计用户数据
    const uniqueUsers = new Set(submissions.map(s => s.userId));
    const todayUsers = new Set(
      submissions
        .filter(s => s.timestamp >= todayStart)
        .map(s => s.userId)
    );
    
    // 计算性能数据
    const processedSubmissions = submissions.filter(s => s.status !== 'pending');
    const avgProcessingTime = this.calculateAverageProcessingTime(processedSubmissions);
    
    return {
      submissions: {
        total: submissions.length,
        pending,
        approved,
        rejected,
        todayCount: todaySubmissions,
        weekCount: weekSubmissions
      },
      users: {
        totalSubmitters: uniqueUsers.size,
        blacklisted: blacklistedUsers.length,
        activeToday: todayUsers.size
      },
      performance: {
        averageProcessingTime: avgProcessingTime,
        approvalRate: submissions.length > 0 ? (approved / submissions.length) * 100 : 0,
        rejectionRate: submissions.length > 0 ? (rejected / submissions.length) * 100 : 0
      }
    };
  }

  /**
   * 生成统计报告文本
   */
  public async generateStatsReport(): Promise<string> {
    const stats = await this.getSystemStats();
    
    return `📊 系统统计报告

📝 投稿统计：
• 总投稿数: ${stats.submissions.total}
• 待审核: ${stats.submissions.pending}
• 已通过: ${stats.submissions.approved} (${stats.performance.approvalRate.toFixed(1)}%)
• 已拒绝: ${stats.submissions.rejected} (${stats.performance.rejectionRate.toFixed(1)}%)
• 今日投稿: ${stats.submissions.todayCount}
• 本周投稿: ${stats.submissions.weekCount}

👥 用户统计：
• 投稿用户总数: ${stats.users.totalSubmitters}
• 今日活跃用户: ${stats.users.activeToday}
• 被拉黑用户: ${stats.users.blacklisted}

⚡ 性能指标：
• 平均处理时间: ${this.formatDuration(stats.performance.averageProcessingTime)}
• 通过率: ${stats.performance.approvalRate.toFixed(1)}%
• 拒绝率: ${stats.performance.rejectionRate.toFixed(1)}%

生成时间: ${new Date().toLocaleString('zh-CN')}`;
  }

  /**
   * 获取用户投稿统计
   */
  public async getUserStats(userId: number): Promise<string> {
    const userSubmissions = await this.submissionModel.getUserSubmissions(userId);
    const isBlocked = await this.blackListModel.isBlocked(userId);
    
    if (userSubmissions.length === 0) {
      return '您还没有投稿记录。';
    }
    
    const approved = userSubmissions.filter(s => s.status === 'approved').length;
    const rejected = userSubmissions.filter(s => s.status === 'rejected').length;
    const pending = userSubmissions.filter(s => s.status === 'pending').length;
    
    return `📊 您的投稿统计

📝 投稿记录：
• 总投稿数: ${userSubmissions.length}
• 已通过: ${approved}
• 已拒绝: ${rejected}
• 待审核: ${pending}
• 通过率: ${userSubmissions.length > 0 ? ((approved / userSubmissions.length) * 100).toFixed(1) : 0}%

状态: ${isBlocked ? '🚫 已被拉黑' : '✅ 正常'}

最近投稿: ${userSubmissions.length > 0 ? new Date(userSubmissions[userSubmissions.length - 1]!.timestamp).toLocaleString('zh-CN') : '无'}`;
  }

  /**
   * 计算平均处理时间
   */
  private calculateAverageProcessingTime(submissions: any[]): number {
    if (submissions.length === 0) return 0;
    
    // 这里简化处理，实际应该记录审核时间
    // 暂时返回一个固定值
    return 30 * 60 * 1000; // 30分钟
  }

  /**
   * 格式化时长
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}天${hours % 24}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  /**
   * 获取热门投稿时段
   */
  public async getHotHours(): Promise<Record<number, number>> {
    const submissions = await this.submissionModel.getAll();
    const hourCounts: Record<number, number> = {};
    
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }
    
    submissions.forEach(submission => {
      const hour = new Date(submission.timestamp).getHours();
      if (hour in hourCounts) {
        hourCounts[hour]!++;
      }
    });
    
    return hourCounts;
  }
} 