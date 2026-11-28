export interface FeedbackItem {
  id: string;
  type: 'bug' | 'feature-request' | 'issue' | 'general';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  timestamp: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'dismissed';
  userAgent?: string;
  appVersion?: string;
  sessionContext?: {
    timerState?: string;
    sessionType?: string;
    currentSession?: boolean;
  };
}

export interface FeedbackFilters {
  type?: FeedbackItem['type'];
  status?: FeedbackItem['status'];
  severity?: FeedbackItem['severity'];
  limit?: number;
}

export type FeedbackUpdate = Partial<Pick<FeedbackItem, 'status'>>;

export interface FeedbackStats {
  total: number;
  open: number;
  resolved: number;
  inProgress: number;
  byType: Record<FeedbackItem['type'], number>;
  bySeverity: Record<FeedbackItem['severity'], number>;
}
