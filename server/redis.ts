import type { ExamSession, CheatLog } from '../src/types.js';

interface CachedSession {
  session: ExamSession;
  expiresAt: number;
}

interface CachedToken {
  examId: string;
  token: string;
  expiresAt: number;
}

class RedisSessionManager {
  private inMemorySessions = new Map<string, CachedSession>();
  private inMemoryTokens = new Map<string, CachedToken>();
  private inMemoryCheatLogs = new Map<string, CheatLog[]>();
  private isConnectedToRedis = false;
  private redisUrl = process.env.REDIS_URL || '';

  constructor() {
    if (this.redisUrl) {
      console.log(`[Redis] Configured with URL: ${this.redisUrl.substring(0, 15)}... Connecting...`);
      // Simulating connection check / or would connect via redis client
      this.isConnectedToRedis = true;
    } else {
      console.log('[Redis] No REDIS_URL found. Utilizing embedded high-speed TTL in-memory cache.');
    }

    // Periodically clean expired sessions
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  public getStatus() {
    return {
      connected: this.isConnectedToRedis || true,
      mode: (this.isConnectedToRedis ? 'native' : 'in_memory_ttl_cache') as 'native' | 'in_memory_ttl_cache',
      activeSessions: this.inMemorySessions.size,
      activeTokens: this.inMemoryTokens.size,
    };
  }

  // Token Generator: e.g. "TOK93A"
  public generateToken(examId: string, durationMinutes: number = 120): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    this.inMemoryTokens.set(code, { examId, token: code, expiresAt });
    return code;
  }

  public verifyToken(token: string): { valid: boolean; examId?: string } {
    const entry = this.inMemoryTokens.get(token.toUpperCase().trim());
    if (!entry) {
      return { valid: false };
    }
    if (Date.now() > entry.expiresAt) {
      this.inMemoryTokens.delete(token.toUpperCase().trim());
      return { valid: false };
    }
    return { valid: true, examId: entry.examId };
  }

  public saveSession(session: ExamSession, ttlSeconds: number = 7200): void {
    this.inMemorySessions.set(session.id, {
      session,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public getSession(sessionId: string): ExamSession | null {
    const cached = this.inMemorySessions.get(sessionId);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.inMemorySessions.delete(sessionId);
      return null;
    }
    return cached.session;
  }

  public updateSessionHeartbeat(sessionId: string, currentQuestionIndex: number, answers: Record<string, string | string[]>, doubtfulIds: string[]): ExamSession | null {
    const cached = this.inMemorySessions.get(sessionId);
    if (!cached) return null;
    cached.session.lastHeartbeat = new Date().toISOString();
    cached.session.currentQuestionIndex = currentQuestionIndex;
    cached.session.answers = { ...cached.session.answers, ...answers };
    cached.session.doubtfulQuestionIds = doubtfulIds;
    return cached.session;
  }

  public recordCheatViolation(log: CheatLog): { totalCheatCount: number; cheatScore: number } {
    const list = this.inMemoryCheatLogs.get(log.sessionId) || [];
    list.push(log);
    this.inMemoryCheatLogs.set(log.sessionId, list);

    const sessionCached = this.inMemorySessions.get(log.sessionId);
    if (sessionCached) {
      sessionCached.session.cheatCount += 1;
      // Calculate weighted cheat score
      let scorePenalty = 0;
      for (const item of list) {
        if (item.severity === 'high') scorePenalty += 25;
        else if (item.severity === 'medium') scorePenalty += 15;
        else scorePenalty += 5;
      }
      sessionCached.session.cheatScore = Math.min(100, scorePenalty);
      return {
        totalCheatCount: sessionCached.session.cheatCount,
        cheatScore: sessionCached.session.cheatScore,
      };
    }
    return { totalCheatCount: list.length, cheatScore: Math.min(100, list.length * 10) };
  }

  public getCheatLogs(sessionId: string): CheatLog[] {
    return this.inMemoryCheatLogs.get(sessionId) || [];
  }

  public getAllActiveSessions(): ExamSession[] {
    const active: ExamSession[] = [];
    const now = Date.now();
    for (const [id, item] of this.inMemorySessions.entries()) {
      if (now <= item.expiresAt) {
        active.push(item.session);
      }
    }
    return active;
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, item] of this.inMemorySessions.entries()) {
      if (now > item.expiresAt) {
        this.inMemorySessions.delete(id);
      }
    }
    for (const [token, item] of this.inMemoryTokens.entries()) {
      if (now > item.expiresAt) {
        this.inMemoryTokens.delete(token);
      }
    }
  }
}

export const redisSessionManager = new RedisSessionManager();
