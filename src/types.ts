export type View = 
  | 'Dashboard' 
  | 'History' 
  | 'Settings' 
  | 'Docs' 
  | 'Overview' 
  | 'Live Trace' 
  | 'Vulnerabilities' 
  | 'Dependency Tree' 
  | 'Audit Logs' 
  | 'Support' 
  | 'Terminal'
  | 'Admin';

export type ToastType = 'success' | 'error' | 'info';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface SystemLog {
  id: number;
  user_id: number | null;
  action: string;
  endpoint?: string;
  status?: number;
  details: string;
  ip: string;
  created_at: string;
  user_name?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  read_status: boolean;
  created_at: string;
}

export interface Dependency {
  name: string;
  version: string;
  vulnerability?: {
    level: 'Low' | 'Medium' | 'High' | 'Critical';
    cve: string;
    suggestion: string;
  };
  dependencies?: Dependency[];
}

export interface TraceStep {
  id: number;
  line: number;
  action: string;
  details: string;
  variables: Record<string, any>;
}

export interface AdminStats {
  totalUsers: number;
  totalAnalyses: number;
  avgRiskScore: number;
  activeUsers: number;
}

export interface Anomaly {
  id: string;
  title: string;
  explanation: string;
  impact: string;
  suggestion: string;
  fix?: string;
  severity: 'High' | 'Medium' | 'Low';
  category: string;
  codeSnippet?: string;
  line?: number;
}

export interface AnalysisResult {
  risk_score: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  issues: Anomaly[];
  summary: string;
  language: string;
  confidence_score: number;
  projectName?: string;
  warning?: string;
  breakdown?: {
    security: number;
    complexity: number;
    maintainability: number;
  };
  metadata?: {
    linesAnalyzed: number;
    complexityLevel: string;
  };
}

export interface HistoryItem {
  id: number;
  name: string;
  date: string;
  score: number;
  status: string;
  code?: string;
  result?: AnalysisResult;
}

export interface UserSettings {
  profile: {
    name: string;
    email: string;
    bio: string;
  };
  security: {
    twoFactor: boolean;
    biometric: boolean;
    sessionTimeout: string;
  };
  apiKeys: {
    id: string;
    name: string;
    key: string;
    created: string;
  }[];
}
