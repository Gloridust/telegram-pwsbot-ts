import { Database } from './Database';
import { SubmissionData } from '../types';

export class SubmissionModel extends Database<SubmissionData> {
  constructor() {
    super('submissions');
  }

  public async createSubmission(submission: SubmissionData): Promise<void> {
    await this.add(submission.id, submission);
  }

  public async getSubmission(id: string): Promise<SubmissionData | null> {
    return await this.get(id);
  }

  public async updateSubmissionStatus(
    id: string, 
    status: 'pending' | 'approved' | 'rejected',
    comment?: string,
    reason?: string
  ): Promise<boolean> {
    const submission = await this.get(id);
    if (!submission) {
      return false;
    }

    submission.status = status;
    if (comment) submission.comment = comment;
    if (reason) submission.reason = reason;

    await this.add(id, submission);
    return true;
  }

  public async getPendingSubmissions(): Promise<SubmissionData[]> {
    const all = await this.getAll();
    return all.filter(sub => sub.status === 'pending');
  }

  public async getUserSubmissions(userId: number): Promise<SubmissionData[]> {
    const all = await this.getAll();
    return all.filter(sub => sub.userId === userId);
  }

  public async deleteSubmission(id: string): Promise<boolean> {
    return await this.remove(id);
  }
} 