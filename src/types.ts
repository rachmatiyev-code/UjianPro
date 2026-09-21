export type EducationLevel = 'SD' | 'SMP' | 'SMA' | 'SMK';

export type SOLOLevel =
  | 'Prestructural' // Pra-struktural
  | 'Unistructural' // Uni-struktural
  | 'Multistructural' // Multi-struktural
  | 'Relational' // Relasional
  | 'Extended Abstract'; // Abstrak Diperluas

export type QuestionType = 'pilihan_ganda' | 'uraian' | 'pilihan_ganda_kompleks';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  code: string; // e.g. SOAL-001
  level: EducationLevel;
  grade: string; // e.g. "Kelas 6", "Kelas 9", "Kelas 12"
  subject: string;
  topic: string;
  type: QuestionType;
  questionText: string;
  imageUrl?: string;
  options?: QuestionOption[];
  correctAnswer: string | string[]; // Single ID or array of IDs
  explanation?: string;
  soloLevel: SOLOLevel;
  bloomLevel?: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
  weight: number; // e.g. 10
  isDummy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  level: EducationLevel;
  grade: string;
  durationMinutes: number;
  passingScore: number; // KKM
  token: string;
  tokenExpiresAt: string;
  questionIds: string[];
  isPublished: boolean;
  isDummy: boolean;
  createdAt: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  grade: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  isDummy: boolean;
  createdAt: string;
}

export interface CheatLog {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  type:
    | 'TAB_SWITCH'
    | 'FACE_ABSENT'
    | 'MULTIPLE_FACES'
    | 'GAZE_DEVIATION'
    | 'FULLSCREEN_EXIT'
    | 'COPY_PASTE_ATTEMPT'
    | 'DEVTOOLS_OPEN';
  description: string;
  severity: 'low' | 'medium' | 'high';
  snapshotUrl?: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  nisn: string;
  tokenUsed: string;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'submitted' | 'locked' | 'timed_out';
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>; // questionId -> answer
  doubtfulQuestionIds: string[]; // Ragu-ragu
  cheatCount: number;
  cheatScore: number; // 0 - 100 index
  isDummy: boolean;
  lastHeartbeat: string;
}

export interface ExamResult {
  id: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  subject: string;
  totalQuestions: number;
  correctCount: number;
  score: number; // 0 - 100
  passed: boolean;
  essayGradingDetails?: Record<
    string,
    {
      score: number;
      feedback: string;
      rubricEvaluated: string;
    }
  >;
  soloPerformance: Record<SOLOLevel, { total: number; correct: number; percentage: number }>;
  cheatScore: number;
  totalViolations: number;
  completedAt: string;
  isDummy: boolean;
}

export interface SchoolProfile {
  name: string;
  dinasHeader: string;
  subHeader: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  accreditation: string;
  academicYear: string;
  headmasterName: string;
  headmasterNip: string;
  logoUrl: string;
}

export interface BackupRecord {
  id: string;
  name: string;
  checksum: string; // SHA-256 for deduplication
  fileSizeBytes: number;
  recordsCount: {
    questions: number;
    students: number;
    exams: number;
    results: number;
  };
  storageLocation: 'Google Drive' | 'Cloud Storage Encrypted' | 'Local Database';
  gdriveFileId?: string;
  gdriveWebViewLink?: string;
  gdriveFolderId?: string;
  gdriveFolderLink?: string;
  isRealCloudUpload?: boolean;
  cloudSyncStatus?: 'uploaded_to_drive' | 'local_vault_only';
  uploadError?: string | null;
  createdAt: string;
  isEncrypted: boolean;
}

export interface ParentNotification {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  monthYear: string; // e.g. "September 2026"
  avgScore: number;
  examsCompleted: number;
  cheatIndexSummary: string;
  status: 'draft' | 'sent';
  sentVia: 'WhatsApp' | 'Email';
  sentAt?: string;
  messageContent: string;
}

export interface SystemStatus {
  postgres: {
    connected: boolean;
    mode: 'native' | 'embedded_pg_compatible';
    host: string;
  };
  redis: {
    connected: boolean;
    mode: 'native' | 'in_memory_ttl_cache';
    activeSessions: number;
  };
  gdrive: {
    folder: string;
    connected: boolean;
    lastBackup: string | null;
    authMethod: string;
    autoRenewEnabled: boolean;
  };
  gdriveAuth: {
    method: 'oauth_refresh_token' | 'service_account' | 'access_token' | 'ready_mock';
    status: 'active_auto_renew' | 'active_permanent' | 'temporary_expiring' | 'ready';
    description: string;
    expiresAt: string | null;
    autoBackupIntervalHours: number;
  };
  dataMode: 'dummy' | 'real';
}
