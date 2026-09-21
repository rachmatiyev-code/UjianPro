import crypto from 'crypto';
import type { BackupRecord } from '../src/types.js';

export interface GDriveAuthConfig {
  authType?: 'refresh_token' | 'service_account' | 'access_token';
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  serviceAccountKeyJson?: string;
  accessToken?: string;
  folderName?: string;
  folderId?: string;
  shareWithEmail?: string;
  autoBackupIntervalHours?: number;
}

export interface GDriveAuthDiagnostics {
  method: 'oauth_refresh_token' | 'service_account' | 'access_token' | 'ready_mock';
  status: 'active_auto_renew' | 'active_permanent' | 'temporary_expiring' | 'ready';
  description: string;
  isAutoRenewing: boolean;
  expiresAt: string | null;
  tokenAgeMinutes: number;
  folder: string;
  folderId?: string | null;
  folderLink?: string | null;
  shareWithEmail?: string | null;
  autoBackupIntervalHours: number;
  deduplicationActive: boolean;
  lastError?: string | null;
  cloudConnected?: boolean;
  accountEmail?: string | null;
  storageQuota?: {
    totalGB: string;
    usedGB: string;
    freeGB: string;
    percentUsed: number;
  } | null;
}

class GoogleDriveBackupService {
  private folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'Backup UjianPro';
  private targetFolderId: string | null = '1I00tLk5AdneGoT9FHdpzNhndWUyjOj3V';
  private targetFolderLink: string | null = 'https://drive.google.com/drive/folders/1I00tLk5AdneGoT9FHdpzNhndWUyjOj3V';
  private shareWithEmail = process.env.GOOGLE_DRIVE_SHARE_EMAIL || 'rachmatiyev@gmail.com';
  private encryptionSecret = process.env.BACKUP_ENCRYPTION_SECRET || 'ujianpro-secure-aes256-key';
  private backupHistory: BackupRecord[] = [];
  private storedSnapshots = new Map<string, string>(); // checksum -> encryptedPayload
  private lastAuthError: string | null = null;
  private accountEmail: string | null = null;
  private storageQuotaInfo: {
    totalGB: string;
    usedGB: string;
    freeGB: string;
    percentUsed: number;
  } | null = null;

  // OAuth & Service Account Credentials State
  private clientId = process.env.GOOGLE_CLIENT_ID || '';
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  private refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  private serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  private serviceAccountPrivateKey = '';

  // Explicit Auth Method Preference ('access_token' | 'oauth_refresh_token' | 'service_account')
  private preferredAuthMethod: 'oauth_refresh_token' | 'service_account' | 'access_token' | null = null;

  // Cached Bearer Access Token & Expiry
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private tokenCreatedAt: number = Date.now();

  // Background Periodic Backup Timer
  private autoBackupIntervalHours = Number(process.env.AUTO_BACKUP_INTERVAL_HOURS) || 6;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private onScheduledBackupCallback: (() => Promise<void>) | null = null;

  constructor() {
    // Robustly parse Service Account credentials from JSON or individual keys
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    if (rawKey.trim().startsWith('{') || rawKey.includes('"private_key"')) {
      try {
        const parsed = JSON.parse(rawKey);
        if (parsed.client_email) this.serviceAccountEmail = parsed.client_email;
        if (parsed.private_key) this.serviceAccountPrivateKey = parsed.private_key;
        console.log(`[GDrive] Initialized Service Account from JSON config: ${this.serviceAccountEmail}`);
      } catch (e) {
        console.warn('[GDrive] Failed to parse service account JSON:', e);
      }
    } else if (rawKey) {
      this.serviceAccountPrivateKey = rawKey;
    }

    if (this.serviceAccountPrivateKey.includes('\\n')) {
      this.serviceAccountPrivateKey = this.serviceAccountPrivateKey.replace(/\\n/g, '\n');
    }

    // Initial synthetic baseline backup for immediate visual reference in dashboard
    const initialChecksum = 'a9f24c3e87d1b069d21e3557e4e16723b7b901a1d9426f8cb51e84364177b942';
    this.backupHistory.push({
      id: 'gdrive_bk_001',
      name: `UjianOnline_Snapshot_Baseline_${new Date().toISOString().slice(0, 10)}.enc.json`,
      checksum: initialChecksum,
      fileSizeBytes: 48920,
      recordsCount: {
        questions: 17,
        students: 24,
        exams: 4,
        results: 16,
      },
      storageLocation: 'Cloud Storage Encrypted',
      gdriveFileId: 'vault_baseline_001',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      isEncrypted: true,
      isRealCloudUpload: false,
      cloudSyncStatus: 'local_vault_only',
      uploadError: 'Snapshot contoh sistem sebelum autentikasi Google Drive dikonfigurasi.',
    });

    this.initAutoBackupScheduler();
  }

  public getAuthMethod(): 'oauth_refresh_token' | 'service_account' | 'access_token' | 'ready_mock' {
    if (this.preferredAuthMethod === 'access_token') {
      if (this.cachedAccessToken) return 'access_token';
    } else if (this.preferredAuthMethod === 'oauth_refresh_token') {
      if (this.refreshToken && this.clientId && this.clientSecret) return 'oauth_refresh_token';
    } else if (this.preferredAuthMethod === 'service_account') {
      if (this.serviceAccountEmail && this.serviceAccountPrivateKey) return 'service_account';
    }

    // Default auto-detection if no explicit preference is set:
    if (this.cachedAccessToken) {
      return 'access_token';
    }
    if (this.refreshToken && this.clientId && this.clientSecret) {
      return 'oauth_refresh_token';
    }
    if (
      this.serviceAccountEmail &&
      this.serviceAccountPrivateKey &&
      (this.serviceAccountPrivateKey.includes('BEGIN PRIVATE KEY') || this.serviceAccountPrivateKey.includes('BEGIN RSA PRIVATE KEY'))
    ) {
      return 'service_account';
    }
    return 'ready_mock';
  }

  public getAuthDiagnostics(): GDriveAuthDiagnostics {
    const method = this.getAuthMethod();
    let status: 'active_auto_renew' | 'active_permanent' | 'temporary_expiring' | 'ready' = 'ready';
    let description = '';
    let isAutoRenewing = false;
    let cloudConnected = false;

    if (method === 'oauth_refresh_token') {
      status = this.lastAuthError ? 'ready' : 'active_auto_renew';
      isAutoRenewing = !this.lastAuthError;
      cloudConnected = !this.lastAuthError;
      description = this.lastAuthError
        ? `Kredensial OAuth terdaftar, namun Google melaporkan kendala: ${this.lastAuthError}`
        : 'OAuth 2.0 dengan Refresh Token aktif. Access token diperbarui otomatis di latar belakang tanpa batas waktu 1 jam.';
    } else if (method === 'service_account') {
      status = this.lastAuthError ? 'ready' : 'active_permanent';
      isAutoRenewing = !this.lastAuthError;
      cloudConnected = !this.lastAuthError;
      description = this.lastAuthError
        ? `Service Account terdaftar, namun penulisan ke Google Drive ditolak: ${this.lastAuthError}`
        : 'Google Cloud Service Account aktif. Otentikasi server-ke-server berjalan mandiri.';
    } else if (method === 'access_token') {
      status = this.lastAuthError ? 'ready' : 'temporary_expiring';
      isAutoRenewing = false;
      cloudConnected = !this.lastAuthError;
      description = this.lastAuthError
        ? `Access Token tidak dapat digunakan: ${this.lastAuthError}`
        : 'Access Token OAuth aktif. Cadangan otomatis diunggah langsung ke akun Google Drive Anda.';
    } else {
      status = 'ready';
      isAutoRenewing = false;
      cloudConnected = false;
      description =
        'Google Drive belum terhubung. Snapshot database tersimpan aman di server vault lokal.';
    }

    const tokenAgeMinutes = Math.floor((Date.now() - this.tokenCreatedAt) / 60000);
    const expiresAt = this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : null;

    return {
      method,
      status,
      description,
      isAutoRenewing,
      expiresAt,
      tokenAgeMinutes,
      folder: this.folderName,
      folderId: this.targetFolderId,
      folderLink: this.targetFolderLink,
      shareWithEmail: this.shareWithEmail,
      autoBackupIntervalHours: this.autoBackupIntervalHours,
      deduplicationActive: true,
      lastError: this.lastAuthError,
      cloudConnected,
      accountEmail: this.accountEmail,
      storageQuota: this.storageQuotaInfo,
    };
  }

  // Active Connection & Storage Quota Test
  public async testDriveConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const method = this.getAuthMethod();
    if (method === 'ready_mock') {
      return {
        success: false,
        message: 'Kredensial atau Token Google Drive belum dimasukkan. Silakan tempel Access Token akun Google Anda pada kolom di atas.',
      };
    }

    const token = await this.getValidAccessToken();
    if (!token) {
      return {
        success: false,
        message: this.lastAuthError || 'Token Google Drive belum dimasukkan atau sudah kedaluwarsa. Silakan perbarui Access Token Anda.',
      };
    }

    // Test 1: Check Drive About / User Profile
    try {
      const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!aboutRes.ok) {
        const errText = await aboutRes.text();
        let errMsg = errText;
        try {
          const j = JSON.parse(errText);
          if (j.error?.message) errMsg = j.error.message;
        } catch (_) {}

        if (
          aboutRes.status === 401 ||
          errMsg.toLowerCase().includes('invalid credential') ||
          errMsg.toLowerCase().includes('token expired')
        ) {
          this.lastAuthError =
            'Access Token tidak valid atau sudah kedaluwarsa (~1 jam). Buka developers.google.com/oauthplayground, otorisasi Drive API v3 (scope drive.file), lalu salin Access Token yang baru.';
        } else {
          this.lastAuthError = `Google API menolak akses (Status ${aboutRes.status}): ${errMsg.slice(0, 150)}`;
        }
        return {
          success: false,
          message: this.lastAuthError,
        };
      }

      const aboutData = (await aboutRes.json()) as any;
      const userEmail = aboutData?.user?.emailAddress || 'User';
      this.accountEmail = userEmail;

      let quotaSummaryStr = '';
      if (aboutData?.storageQuota) {
        const limitBytes = Number(aboutData.storageQuota.limit || 0);
        const usageBytes = Number(aboutData.storageQuota.usage || 0);
        if (limitBytes > 0) {
          const totalGB = (limitBytes / (1024 * 1024 * 1024)).toFixed(1);
          const usedGB = (usageBytes / (1024 * 1024 * 1024)).toFixed(1);
          const freeGB = Math.max(0, (limitBytes - usageBytes) / (1024 * 1024 * 1024)).toFixed(1);
          const percentUsed = Math.min(100, Math.round((usageBytes / limitBytes) * 100));
          this.storageQuotaInfo = { totalGB, usedGB, freeGB, percentUsed };
          quotaSummaryStr = ` (Total Kuota: ${totalGB} GB, Sisa: ${freeGB} GB)`;
        }
      }

      // Test 2: Check target folder
      const folderInfo = await this.getOrCreateFolder(token);
      if (!folderInfo) {
        return {
          success: false,
          message: `Gagal mengakses atau membuat folder "${this.folderName}" di Google Drive akun ${userEmail}.`,
        };
      }

      // Test 3: Test write a tiny diagnostic canary file to verify actual storage quota
      const canaryBoundary = '---canary_boundary_9876';
      const canaryMeta = {
        name: '.ujianpro_canary_test.json',
        mimeType: 'application/json',
        parents: [folderInfo.folderId],
        description: 'Temporary canary test file to verify storage quota.',
      };
      const canaryBody =
        `\r\n--${canaryBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(canaryMeta) +
        `\r\n--${canaryBoundary}\r\nContent-Type: application/json\r\n\r\n` +
        JSON.stringify({ test: true, timestamp: Date.now() }) +
        `\r\n--${canaryBoundary}--`;

      const canaryRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${canaryBoundary}`,
        },
        body: canaryBody,
      });

      if (!canaryRes.ok) {
        const canaryErr = await canaryRes.text();
        let parsedErr = canaryErr;
        try {
          const j = JSON.parse(canaryErr);
          if (j.error?.message) parsedErr = j.error.message;
        } catch (_) {}

        if (parsedErr.includes('storage quota') || parsedErr.includes('storageQuotaExceeded')) {
          const friendlyMsg =
            'Google menolak penulisan: Kuota penyimpanan akun tidak mencukupi atau Service Account tidak memiliki storage drive sendiri. Gunakan Access Token / Refresh Token akun Google Drive pribadi Anda (misal Google One 100 GB).';
          this.lastAuthError = friendlyMsg;
          return {
            success: false,
            message: friendlyMsg,
          };
        }

        this.lastAuthError = `Gagal menguji penulisan ke Google Drive (${canaryRes.status}): ${parsedErr}`;
        return {
          success: false,
          message: this.lastAuthError,
        };
      }

      // Clean up canary file
      const canaryData = (await canaryRes.json()) as { id: string };
      if (canaryData?.id) {
        fetch(`https://www.googleapis.com/drive/v3/files/${canaryData.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      this.lastAuthError = null;
      return {
        success: true,
        message: `Koneksi Google Drive Sukses! Terhubung ke akun: ${userEmail}${quotaSummaryStr}. Kuota aktif dan folder "${this.folderName}" siap menerima cadangan database.`,
        details: {
          userEmail,
          folderId: folderInfo.folderId,
          folderLink: folderInfo.folderLink,
          storageQuota: this.storageQuotaInfo,
        },
      };
    } catch (err: any) {
      this.lastAuthError = `Koneksi Google Drive gagal: ${err.message}`;
      return {
        success: false,
        message: this.lastAuthError,
      };
    }
  }

  public async updateCredentials(config: GDriveAuthConfig): Promise<{
    success: boolean;
    message: string;
    status: GDriveAuthDiagnostics;
  }> {
    if (config.folderName) this.folderName = config.folderName.trim();
    if (config.folderId !== undefined) {
      this.targetFolderId = config.folderId.trim() || null;
      if (!this.targetFolderId) this.targetFolderLink = null;
    }
    if (config.shareWithEmail) this.shareWithEmail = config.shareWithEmail.trim();

    if (config.authType) {
      if (config.authType === 'access_token') {
        this.preferredAuthMethod = 'access_token';
      } else if (config.authType === 'refresh_token') {
        this.preferredAuthMethod = 'oauth_refresh_token';
      } else if (config.authType === 'service_account') {
        this.preferredAuthMethod = 'service_account';
      }
    }

    if (config.clientId !== undefined) this.clientId = config.clientId.trim();
    if (config.clientSecret !== undefined) this.clientSecret = config.clientSecret.trim();
    if (config.refreshToken !== undefined) this.refreshToken = config.refreshToken.trim();
    if (config.serviceAccountEmail !== undefined) this.serviceAccountEmail = config.serviceAccountEmail.trim();
    if (config.serviceAccountPrivateKey !== undefined) this.serviceAccountPrivateKey = config.serviceAccountPrivateKey.trim();

    if (config.accessToken !== undefined) {
      const cleanToken = config.accessToken.trim();
      if (cleanToken) {
        this.cachedAccessToken = cleanToken;
        this.tokenExpiresAt = Date.now() + 3600 * 1000;
        this.tokenCreatedAt = Date.now();
        this.preferredAuthMethod = 'access_token';
        this.lastAuthError = null;
      }
    }

    if (config.serviceAccountKeyJson) {
      try {
        const parsed = JSON.parse(config.serviceAccountKeyJson);
        if (parsed.client_email) this.serviceAccountEmail = parsed.client_email.trim();
        if (parsed.private_key) this.serviceAccountPrivateKey = parsed.private_key.trim();
        this.preferredAuthMethod = 'service_account';
        this.lastAuthError = null;
      } catch (e: any) {
        this.lastAuthError = `Format JSON Service Account tidak valid: ${e.message}`;
        return {
          success: false,
          message: `Format JSON Service Account Key tidak valid: ${e.message}`,
          status: this.getAuthDiagnostics(),
        };
      }
    }

    if (config.autoBackupIntervalHours && config.autoBackupIntervalHours > 0) {
      this.autoBackupIntervalHours = config.autoBackupIntervalHours;
      this.initAutoBackupScheduler();
    }

    // Proactively verify credentials and folder
    const method = this.getAuthMethod();
    let token: string | null = null;
    if (method === 'oauth_refresh_token') {
      token = await this.refreshOAuthToken();
      if (!token) {
        return {
          success: false,
          message: this.lastAuthError || 'Gagal menukar Refresh Token ke Google OAuth. Pastikan Client ID, Client Secret, dan Refresh Token valid.',
          status: this.getAuthDiagnostics(),
        };
      }
    } else if (method === 'service_account') {
      token = await this.getServiceAccountAccessToken();
      if (!token) {
        return {
          success: false,
          message: this.lastAuthError || 'Gagal otentikasi Google Service Account. Pastikan client_email dan private_key RSA valid.',
          status: this.getAuthDiagnostics(),
        };
      }
    } else if (method === 'access_token') {
      token = this.cachedAccessToken;
    }

    // If token is valid, verify or create the target folder in Google Drive!
    if (token) {
      const folderInfo = await this.getOrCreateFolder(token);
      if (folderInfo) {
        this.targetFolderId = folderInfo.folderId;
        this.targetFolderLink = folderInfo.folderLink;
      }
    }

    return {
      success: true,
      message: `Kredensial Google Drive berhasil divalidasi! Target folder: "${this.folderName}" siap menerima sinkronisasi.`,
      status: this.getAuthDiagnostics(),
    };
  }

  private async refreshOAuthToken(): Promise<string | null> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      this.lastAuthError = 'Client ID, Client Secret, atau Refresh Token belum lengkap.';
      return null;
    }

    try {
      const bodyParams = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GDrive] Refresh token exchange failed:', response.status, errorText);
        let parsedMessage = errorText;
        try {
          const jsonErr = JSON.parse(errorText);
          if (jsonErr.error_description) parsedMessage = jsonErr.error_description;
          else if (jsonErr.error) parsedMessage = jsonErr.error;
        } catch (_) {}
        this.lastAuthError = `Google OAuth Error (${response.status}): ${parsedMessage}`;
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number };
      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 120) * 1000;
      this.tokenCreatedAt = Date.now();
      this.lastAuthError = null;
      console.log('[GDrive] Successfully refreshed OAuth2 access token via Refresh Token.');
      return this.cachedAccessToken;
    } catch (err: any) {
      console.error('[GDrive] Network error during OAuth refresh token exchange:', err);
      this.lastAuthError = `Koneksi ke server Google OAuth gagal: ${err.message}`;
      return null;
    }
  }

  private async getServiceAccountAccessToken(): Promise<string | null> {
    if (!this.serviceAccountEmail || !this.serviceAccountPrivateKey) {
      return null;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = {
        iss: this.serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const base64Url = (obj: object) =>
        Buffer.from(JSON.stringify(obj))
          .toString('base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');

      const encodedHeader = base64Url(header);
      const encodedPayload = base64Url(payload);
      const signInput = `${encodedHeader}.${encodedPayload}`;

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signInput);
      signer.end();
      const signature = signer
        .sign(this.serviceAccountPrivateKey, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const jwtAssertion = `${signInput}.${signature}`;

      const bodyParams = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtAssertion,
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GDrive] Service Account token exchange failed:', response.status, errorText);
        this.lastAuthError = `Service Account Error (${response.status}): ${errorText.slice(0, 100)}`;
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number };
      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 120) * 1000;
      this.tokenCreatedAt = Date.now();
      this.lastAuthError = null;
      return this.cachedAccessToken;
    } catch (err: any) {
      console.error('[GDrive] Error creating Service Account token:', err);
      this.lastAuthError = `Service Account error: ${err.message}`;
      return null;
    }
  }

  public async getValidAccessToken(): Promise<string | null> {
    const method = this.getAuthMethod();

    if (method === 'access_token') {
      if (this.cachedAccessToken && (!this.tokenExpiresAt || Date.now() < this.tokenExpiresAt)) {
        return this.cachedAccessToken;
      }
      return this.cachedAccessToken;
    }

    const isTokenValid =
      this.cachedAccessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt - 60000;

    if (isTokenValid) {
      return this.cachedAccessToken;
    }

    if (method === 'oauth_refresh_token') {
      const refreshed = await this.refreshOAuthToken();
      if (refreshed) return refreshed;
    } else if (method === 'service_account') {
      const generated = await this.getServiceAccountAccessToken();
      if (generated) return generated;
    }

    return this.cachedAccessToken;
  }

  // Find or automatically create target folder in Google Drive
  private async getOrCreateFolder(token: string): Promise<{ folderId: string; folderLink: string } | null> {
    try {
      if (this.targetFolderId) {
        // Verify folder exists and get metadata
        const checkRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${this.targetFolderId}?fields=id,name,webViewLink,trashed`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (checkRes.ok) {
          const f = (await checkRes.json()) as { id: string; webViewLink?: string; trashed?: boolean };
          if (!f.trashed) {
            return {
              folderId: f.id,
              folderLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
            };
          }
        }
      }

      // Search for folder by name
      const escapedName = this.folderName.replace(/'/g, "\\'");
      const query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (searchRes.ok) {
        const data = (await searchRes.json()) as { files?: Array<{ id: string; webViewLink?: string }> };
        if (data.files && data.files.length > 0) {
          const f = data.files[0];
          this.targetFolderId = f.id;
          this.targetFolderLink = f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`;
          return { folderId: f.id, folderLink: this.targetFolderLink };
        }
      }

      // Folder not found; create it in Google Drive root
      console.log(`[GDrive] Folder "${this.folderName}" not found in Drive. Creating new folder...`);
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.folderName,
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Folder Penyimpanan Cadangan Otomatis Database UjianPro (AES-256 Checksum)',
        }),
      });

      if (createRes.ok) {
        const folderData = (await createRes.json()) as { id: string; webViewLink?: string };
        this.targetFolderId = folderData.id;
        this.targetFolderLink = folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`;
        console.log(`[GDrive] Successfully created folder "${this.folderName}" with ID: ${folderData.id}`);

        // If using Service Account, share with the teacher's Google email so it appears in Drive "Shared with me"
        if (this.serviceAccountEmail && this.shareWithEmail) {
          await this.shareFolderWithUser(token, folderData.id, this.shareWithEmail);
        }

        return { folderId: folderData.id, folderLink: this.targetFolderLink };
      } else {
        const errText = await createRes.text();
        console.warn('[GDrive] Failed to create folder in Drive:', createRes.status, errText);
        return null;
      }
    } catch (err) {
      console.error('[GDrive] Error resolving target folder:', err);
      return null;
    }
  }

  private async shareFolderWithUser(token: string, folderId: string, email: string) {
    try {
      const shareRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: email,
        }),
      });
      if (shareRes.ok) {
        console.log(`[GDrive] Successfully shared folder ${folderId} with ${email}`);
      } else {
        console.warn(`[GDrive] Could not auto-share folder with ${email}: ${shareRes.status}`);
      }
    } catch (err) {
      console.warn('[GDrive] Error auto-sharing folder:', err);
    }
  }

  // Upload file directly into target folder via Google Drive API v3
  private async uploadToGoogleDriveAPI(
    fileName: string,
    fileContent: string,
    checksum: string
  ): Promise<
    | {
        fileId: string;
        webViewLink: string;
        folderId?: string;
        folderLink?: string;
      }
    | { error: string }
  > {
    const token = await this.getValidAccessToken();
    if (!token) {
      const err = this.lastAuthError || 'Token Google Drive belum dikonfigurasi atau kedaluwarsa.';
      return { error: err };
    }

    // Resolve or create target folder in Google Drive
    const folderInfo = await this.getOrCreateFolder(token);
    const folderId = folderInfo?.folderId || this.targetFolderId;
    const folderLink = folderInfo?.folderLink || this.targetFolderLink;

    try {
      const metadata: any = {
        name: fileName,
        mimeType: 'application/json',
        description: `UjianPro Encrypted Database Backup (SHA-256: ${checksum}) di folder ${this.folderName}`,
      };

      // Crucial: Place file directly inside target folder!
      if (folderId) {
        metadata.parents = [folderId];
      }

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelimiter;

      let uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      // If token expired (401), automatically clear cache, fetch a fresh token, and retry once
      if (uploadResponse.status === 401) {
        console.warn('[GDrive] Upload encountered 401 Unauthorized. Refreshing token and retrying...');
        this.cachedAccessToken = null;
        this.tokenExpiresAt = null;
        const freshToken = await this.getValidAccessToken();
        if (freshToken) {
          uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${freshToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartRequestBody,
            }
          );
        }
      }

      if (uploadResponse.ok) {
        const uploadedData = (await uploadResponse.json()) as {
          id: string;
          name: string;
          webViewLink?: string;
        };
        console.log(`[GDrive] Successfully uploaded backup to Google Drive with ID: ${uploadedData.id}`);
        this.lastAuthError = null;
        return {
          fileId: uploadedData.id,
          webViewLink: uploadedData.webViewLink || `https://drive.google.com/file/d/${uploadedData.id}/view`,
          folderId: folderId || undefined,
          folderLink: folderLink || undefined,
        };
      } else {
        const errorText = await uploadResponse.text();
        console.warn(`[GDrive] Google Drive API upload returned status ${uploadResponse.status}:`, errorText);
        let msg = `Google Drive API error (${uploadResponse.status})`;
        try {
          const j = JSON.parse(errorText);
          if (j.error?.message) msg += `: ${j.error.message}`;
        } catch (_) {}
        this.lastAuthError = msg;
        return { error: msg };
      }
    } catch (err: any) {
      console.warn('[GDrive] Network attempt to Drive API failed:', err);
      const msg = `Gagal menghubungi Google Drive: ${err.message}`;
      this.lastAuthError = msg;
      return { error: msg };
    }
  }

  public registerScheduledBackupCallback(cb: () => Promise<void>) {
    this.onScheduledBackupCallback = cb;
  }

  private initAutoBackupScheduler() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }

    const intervalMs = this.autoBackupIntervalHours * 3600 * 1000;
    this.autoBackupTimer = setInterval(async () => {
      console.log(`[GDrive Auto-Backup] Running periodic backup trigger (every ${this.autoBackupIntervalHours}h)...`);
      if (this.onScheduledBackupCallback) {
        try {
          await this.onScheduledBackupCallback();
        } catch (e) {
          console.error('[GDrive Auto-Backup] Scheduled run encountered error:', e);
        }
      }
    }, intervalMs);
  }

  public getFolderName(): string {
    return this.folderName;
  }

  public getFolderId(): string | null {
    return this.targetFolderId;
  }

  public getFolderLink(): string | null {
    return this.targetFolderLink;
  }

  public getBackupHistory(): BackupRecord[] {
    return [...this.backupHistory];
  }

  public calculateChecksum(dataString: string): string {
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private encryptPayload(plainText: string): string {
    try {
      const key = crypto.createHash('sha256').update(this.encryptionSecret).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch {
      return Buffer.from(plainText).toString('base64');
    }
  }

  public decryptPayload(cipherText: string): string {
    try {
      if (cipherText.includes(':')) {
        const [ivHex, encHex] = cipherText.split(':');
        const key = crypto.createHash('sha256').update(this.encryptionSecret).digest();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
      return Buffer.from(cipherText, 'base64').toString('utf8');
    } catch (e) {
      console.error('Decryption failed, falling back to raw:', e);
      return cipherText;
    }
  }

  // Sync to Google Drive with Strict Deduplication and Transparent Cloud Verification
  public async syncDatabaseSnapshot(
    databaseContent: object,
    recordsSummary: { questions: number; students: number; exams: number; results: number },
    forceUpload: boolean = false
  ): Promise<{
    success: boolean;
    isDuplicate: boolean;
    message: string;
    backup?: BackupRecord;
    driveUploaded?: boolean;
    folderLink?: string;
  }> {
    const rawJson = JSON.stringify(databaseContent);
    const checksum = this.calculateChecksum(rawJson);

    // STRICT DEDUPLICATION CHECK:
    // If exact checksum already exists AND was already successfully uploaded to Google Drive, skip.
    const existing = this.backupHistory.find((b) => b.checksum === checksum);
    if (existing && existing.isRealCloudUpload && !forceUpload) {
      return {
        success: true,
        isDuplicate: true,
        driveUploaded: true,
        folderLink: existing.gdriveFolderLink || this.targetFolderLink || undefined,
        message: `Sinkronisasi dilewati: Konten database identik dengan cadangan "${existing.name}". File sudah tersimpan di folder Google Drive "${this.folderName}" (Anti-Duplikasi Aktif).`,
        backup: existing,
      };
    }

    const encrypted = this.encryptPayload(rawJson);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `UjianPro_Backup_${dateStr}.enc.json`;

    // Attempt real Drive API upload
    const uploadResult = await this.uploadToGoogleDriveAPI(fileName, encrypted, checksum);

    let isRealCloudUpload = false;
    let fileId: string;
    let webViewLink: string | undefined;
    let folderId: string | undefined;
    let folderLink: string | undefined;
    let uploadError: string | null = null;

    if ('fileId' in uploadResult) {
      isRealCloudUpload = true;
      fileId = uploadResult.fileId;
      webViewLink = uploadResult.webViewLink;
      folderId = uploadResult.folderId;
      folderLink = uploadResult.folderLink;
      this.targetFolderId = folderId || this.targetFolderId;
      this.targetFolderLink = folderLink || this.targetFolderLink;
    } else {
      isRealCloudUpload = false;
      fileId = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      uploadError = uploadResult.error;
    }

    const newRecord: BackupRecord = {
      id: `bk_${Date.now()}`,
      name: fileName,
      checksum,
      fileSizeBytes: Buffer.byteLength(encrypted, 'utf8'),
      recordsCount: recordsSummary,
      storageLocation: isRealCloudUpload ? 'Google Drive' : 'Cloud Storage Encrypted',
      gdriveFileId: fileId,
      gdriveWebViewLink: webViewLink,
      gdriveFolderId: folderId,
      gdriveFolderLink: folderLink,
      isRealCloudUpload,
      cloudSyncStatus: isRealCloudUpload ? 'uploaded_to_drive' : 'local_vault_only',
      uploadError,
      createdAt: new Date().toISOString(),
      isEncrypted: true,
    };

    this.storedSnapshots.set(checksum, encrypted);

    // Remove older duplicate if upgrading from local vault to real Google Drive
    if (existing) {
      this.deleteBackup(existing.id);
    }
    this.backupHistory.unshift(newRecord);

    if (isRealCloudUpload) {
      return {
        success: true,
        isDuplicate: false,
        driveUploaded: true,
        folderLink,
        message: `✓ Berhasil disinkronkan ke Google Drive! File tersimpan di folder "${this.folderName}" (File ID: ${fileId}).`,
        backup: newRecord,
      };
    } else {
      return {
        success: true,
        isDuplicate: false,
        driveUploaded: false,
        message: `Snapshot database berhasil diamankan di vault lokal server, NAMUN belum terunggah ke Google Drive (${uploadError}). Silakan periksa kredensial Google Drive Anda.`,
        backup: newRecord,
      };
    }
  }

  public getSnapshotPayload(checksum: string): string | null {
    return this.storedSnapshots.get(checksum) || null;
  }

  public deleteBackup(id: string): boolean {
    const idx = this.backupHistory.findIndex((b) => b.id === id);
    if (idx !== -1) {
      const removed = this.backupHistory.splice(idx, 1)[0];
      this.storedSnapshots.delete(removed.checksum);
      return true;
    }
    return false;
  }
}

export const googleDriveBackupService = new GoogleDriveBackupService();
