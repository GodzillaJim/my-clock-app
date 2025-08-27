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