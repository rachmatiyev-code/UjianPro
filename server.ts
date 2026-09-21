import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbRepository } from './server/db.js';
import { redisSessionManager } from './server/redis.js';
import { googleDriveBackupService } from './server/gdrive.js';
import { generateQuestionWithAI, gradeEssayWithAI, setGeminiApiKey, getGeminiApiStatus } from './server/gemini.js';
import type { Question, Exam, Student, ExamResult, SOLOLevel, ExamSession } from './src/types.js';

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Register background automated backup callback
googleDriveBackupService.registerScheduledBackupCallback(async () => {
    const state = dbRepository.getState();
    const summary = {
      questions: state.questions.length,
      students: state.students.length,
      exams: state.exams.length,
      results: state.results.length,
    };
    await googleDriveBackupService.syncDatabaseSnapshot(state, summary);
  });

  // ==========================================
  // SYSTEM & DATABASE STATUS APIS
  // ==========================================
  app.get('/api/system/status', (req, res) => {
    const pgStatus = dbRepository.getPostgresStatus();
    const redisStatus = redisSessionManager.getStatus();
    const gdriveFolder = googleDriveBackupService.getFolderName();
    const backups = googleDriveBackupService.getBackupHistory();
    const latestBackup = backups.length > 0 ? backups[0].createdAt : null;
    const gdriveAuth = googleDriveBackupService.getAuthDiagnostics();

    res.json({
      postgres: pgStatus,
      redis: redisStatus,
      gdrive: {
        folder: gdriveFolder,
        connected: true,
        lastBackup: latestBackup,
        authMethod: gdriveAuth.method,
        autoRenewEnabled: gdriveAuth.isAutoRenewing,
      },
      gdriveAuth,
      dataMode: req.query.mode || 'dummy',
    });
  });

  app.get('/api/system/postgres-sql', (req, res) => {
    const sql = dbRepository.exportPostgresSQL();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ujianpro_postgres_schema.sql"');
    res.send(sql);
  });

  // ==========================================
  // QUESTION BANK APIS (Bank Soal)
  // ==========================================
  app.get('/api/questions', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const questions = dbRepository.getQuestions(isDummy);
    res.json(questions);
  });

  app.post('/api/questions', (req, res) => {
    const body = req.body;
    const isDummy = req.query.mode === 'dummy';
    const newQuestion: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: body.code || `SOAL-${Math.floor(100 + Math.random() * 900)}`,
      level: body.level || 'SMA',
      grade: body.grade || 'Kelas 12',
      subject: body.subject || 'Umum',
      topic: body.topic || 'Topik Umum',
      type: body.type || 'pilihan_ganda',
      questionText: body.questionText || '',
      imageUrl: body.imageUrl || undefined,
      options: body.options || undefined,
      correctAnswer: body.correctAnswer || 'opt_a',
      explanation: body.explanation || '',
      soloLevel: body.soloLevel || 'Unistructural',
      bloomLevel: body.bloomLevel || 'C3',
      weight: Number(body.weight) || 10,
      isDummy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = dbRepository.addQuestion(newQuestion);
    res.status(201).json(created);
  });

  app.put('/api/questions/:id', (req, res) => {
    const updated = dbRepository.updateQuestion(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Question not found' });
    res.json(updated);
  });

  app.delete('/api/questions/:id', (req, res) => {
    const success = dbRepository.deleteQuestion(req.params.id);
    if (!success) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true });
  });

  // ==========================================
  // GEMINI AI CONFIGURATION & STATUS APIS
  // ==========================================
  app.get('/api/ai/status', (req, res) => {
    res.json(getGeminiApiStatus());
  });

  app.post('/api/ai/config-key', (req, res) => {
    const { apiKey } = req.body;
    if (typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'Field apiKey harus berupa string' });
    }
    const result = setGeminiApiKey(apiKey);
    const status = getGeminiApiStatus();
    res.json({
      success: result.success,
      message: result.message,
      status,
    });
  });

  // AI Question Generation with Gemini
  app.post('/api/questions/generate-ai', async (req, res) => {
    try {
      const { level, grade, subject, topic, soloLevel, type, count, customPrompt } = req.body;
      const isDummy = req.query.mode === 'dummy';

      const generated = await generateQuestionWithAI({
        level: level || 'SMA',
        grade: grade || 'Kelas 12',
        subject: subject || 'Matematika',
        topic: topic || 'Aljabar',
        soloLevel: soloLevel || 'Relational',
        type: type || 'pilihan_ganda',
        count: count || 1,
        customPrompt: typeof customPrompt === 'string' ? customPrompt.trim() : undefined,
      });

      // Save to repository automatically
      const savedQuestions: Question[] = [];
      for (const item of generated) {
        const fullQuestion: Question = {
          id: `q_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          code: item.code || `AI-${Math.floor(100 + Math.random() * 900)}`,
          level: item.level || 'SMA',
          grade: item.grade || 'Kelas 12',
          subject: item.subject || subject,
          topic: item.topic || topic,
          type: item.type || type,
          questionText: item.questionText || '',
          imageUrl: item.imageUrl,
          options: item.options,
          correctAnswer: item.correctAnswer || 'opt_a',
          explanation: item.explanation || '',
          soloLevel: item.soloLevel || 'Relational',
          bloomLevel: item.bloomLevel || 'C4',
          weight: item.weight || 10,
          isDummy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        savedQuestions.push(dbRepository.addQuestion(fullQuestion));
      }

      res.json({
        success: true,
        count: savedQuestions.length,
        questions: savedQuestions,
      });
    } catch (err: any) {
      console.error('Error generating questions with Gemini:', err);
      res.status(500).json({ error: err.message || 'Failed to generate question with AI' });
    }
  });

  // ==========================================
  // EXAM APIS
  // ==========================================
  app.get('/api/exams', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const exams = dbRepository.getExams(isDummy);
    res.json(exams);
  });

  app.post('/api/exams', (req, res) => {
    const body = req.body;
    const isDummy = req.query.mode === 'dummy';
    const examId = `ex_${Date.now()}`;
    const token = redisSessionManager.generateToken(examId, (body.durationMinutes || 90) * 2);

    const newExam: Exam = {
      id: examId,
      title: body.title || 'Ujian Baru',
      subject: body.subject || 'Umum',
      level: body.level || 'SMA',
      grade: body.grade || 'Kelas 12',
      durationMinutes: Number(body.durationMinutes) || 60,
      passingScore: Number(body.passingScore) || 75,
      token,
      tokenExpiresAt: new Date(Date.now() + (body.durationMinutes || 90) * 2 * 60 * 1000).toISOString(),
      questionIds: body.questionIds || [],
      isPublished: body.isPublished !== false,
      isDummy,
      createdAt: new Date().toISOString(),
    };
    const created = dbRepository.addExam(newExam);
    res.status(201).json(created);
  });

  app.put('/api/exams/:id', (req, res) => {
    const updated = dbRepository.updateExam(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Exam not found' });
    res.json(updated);
  });

  app.delete('/api/exams/:id', (req, res) => {
    const success = dbRepository.deleteExam(req.params.id);
    if (!success) return res.status(404).json({ error: 'Exam not found' });
    res.json({ success: true });
  });

  app.post('/api/exams/:id/refresh-token', (req, res) => {
    const exam = dbRepository.getExams(false).concat(dbRepository.getExams(true)).find((e) => e.id === req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const newToken = redisSessionManager.generateToken(exam.id, exam.durationMinutes * 2);
    const updated = dbRepository.updateExam(exam.id, {
      token: newToken,
      tokenExpiresAt: new Date(Date.now() + exam.durationMinutes * 2 * 60 * 1000).toISOString(),
    });
    res.json(updated);
  });

  // ==========================================
  // STUDENT APIS & SPREADSHEET IMPORT/EXPORT
  // ==========================================
  app.get('/api/students', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const students = dbRepository.getStudents(isDummy);
    res.json(students);
  });

  app.post('/api/students', (req, res) => {
    const body = req.body;
    const isDummy = req.query.mode === 'dummy';
    const newStudent: Student = {
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nisn: body.nisn || `00${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: body.name || 'Siswa Baru',
      grade: body.grade || 'Kelas 12',
      className: body.className || 'XII MIPA 1',
      parentName: body.parentName || 'Orang Tua',
      parentPhone: body.parentPhone || '+628123456789',
      parentEmail: body.parentEmail || 'orangtua@gmail.com',
      isDummy,
      createdAt: new Date().toISOString(),
    };
    const created = dbRepository.addStudent(newStudent);
    res.status(201).json(created);
  });

  app.put('/api/students/:id', (req, res) => {
    const updated = dbRepository.updateStudent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Student not found' });
    res.json(updated);
  });

  app.delete('/api/students/:id', (req, res) => {
    const success = dbRepository.deleteStudent(req.params.id);
    if (!success) return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true });
  });

  // Bulk Import Students from Spreadsheet (CSV / JSON payload)
  app.post('/api/students/import', (req, res) => {
    const { studentsList } = req.body;
    const isDummy = req.query.mode === 'dummy';
    if (!Array.isArray(studentsList)) {
      return res.status(400).json({ error: 'Invalid studentsList array format' });
    }

    const inserted: Student[] = [];
    for (const item of studentsList) {
      if (!item.name || !item.nisn) continue;
      const newStudent: Student = {
        id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nisn: String(item.nisn).trim(),
        name: String(item.name).trim(),
        grade: item.grade || 'Kelas 12',
        className: item.className || 'XII MIPA 1',
        parentName: item.parentName || 'Orang Tua',
        parentPhone: item.parentPhone || '+6281234567890',
        parentEmail: item.parentEmail || 'wali@gmail.com',
        isDummy,
        createdAt: new Date().toISOString(),
      };
      inserted.push(dbRepository.addStudent(newStudent));
    }

    res.json({
      success: true,
      message: `Berhasil mengimpor ${inserted.length} data siswa dari spreadsheet.`,
      count: inserted.length,
      students: inserted,
    });
  });

  // ==========================================
  // RESULTS & EXAM ANALYTICS APIS
  // ==========================================
  app.get('/api/results', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const results = dbRepository.getResults(isDummy);
    res.json(results);
  });

  app.delete('/api/results/:id', (req, res) => {
    const success = dbRepository.deleteResult(req.params.id);
    if (!success) return res.status(404).json({ error: 'Result not found' });
    res.json({ success: true });
  });

  // ==========================================
  // SCHOOL PROFILE & KOP SURAT APIS
  // ==========================================
  app.get('/api/school-profile', (req, res) => {
    res.json(dbRepository.getSchoolProfile());
  });

  app.put('/api/school-profile', (req, res) => {
    const updated = dbRepository.updateSchoolProfile(req.body);
    res.json(updated);
  });

  // ==========================================
  // STUDENT EXAM ROOM (MODE SISWA) & ANTI-CHEAT
  // ==========================================
  app.post('/api/exam/verify-token', (req, res) => {
    const { token, nisn } = req.body;
    if (!token || !nisn) {
      return res.status(400).json({ error: 'Token ujian dan NISN wajib diisi' });
    }

    // Check token in Redis session manager or in exams db
    const cleanToken = token.trim().toUpperCase();
    const allExams = [...dbRepository.getExams(false), ...dbRepository.getExams(true)];
    const targetExam = allExams.find((e) => e.token.toUpperCase() === cleanToken);

    if (!targetExam) {
      return res.status(401).json({ error: 'Token ujian tidak valid atau sudah kedaluwarsa!' });
    }

    // Match student by NISN
    const allStudents = [...dbRepository.getStudents(false), ...dbRepository.getStudents(true)];
    const student = allStudents.find((s) => s.nisn.trim() === nisn.trim());

    if (!student) {
      return res.status(404).json({ error: 'NISN tidak terdaftar dalam database peserta ujian!' });
    }

    // Fetch questions assigned to this exam
    const allQuestions = [...dbRepository.getQuestions(false), ...dbRepository.getQuestions(true)];
    const examQuestions = targetExam.questionIds
      .map((qid) => allQuestions.find((q) => q.id === qid))
      .filter((q): q is Question => Boolean(q));

    // If exam has no specific questions assigned yet, pick questions of the same subject or level
    const questionsToServe =
      examQuestions.length > 0
        ? examQuestions
        : allQuestions.filter((q) => q.level === targetExam.level && q.isDummy === targetExam.isDummy).slice(0, 10);

    // Create session in Redis
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const session: ExamSession = {
      id: sessionId,
      examId: targetExam.id,
      studentId: student.id,
      studentName: student.name,
      nisn: student.nisn,
      tokenUsed: cleanToken,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      currentQuestionIndex: 0,
      answers: {},
      doubtfulQuestionIds: [],
      cheatCount: 0,
      cheatScore: 0,
      isDummy: targetExam.isDummy,
      lastHeartbeat: new Date().toISOString(),
    };

    redisSessionManager.saveSession(session, targetExam.durationMinutes * 60 + 600);

    // Filter out correct answers before sending to student client (Security rule)
    const sanitizedQuestions = questionsToServe.map((q) => {
      const { correctAnswer, explanation, ...sanitized } = q;
      return sanitized;
    });

    res.json({
      success: true,
      sessionId,
      exam: {
        id: targetExam.id,
        title: targetExam.title,
        subject: targetExam.subject,
        level: targetExam.level,
        grade: targetExam.grade,
        durationMinutes: targetExam.durationMinutes,
        passingScore: targetExam.passingScore,
      },
      student: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
        className: student.className,
      },
      questions: sanitizedQuestions,
    });
  });

  // Student Heartbeat & Auto-Save
  app.post('/api/exam/heartbeat', (req, res) => {
    const { sessionId, currentQuestionIndex, answers, doubtfulQuestionIds } = req.body;
    const updatedSession = redisSessionManager.updateSessionHeartbeat(
      sessionId,
      currentQuestionIndex || 0,
      answers || {},
      doubtfulQuestionIds || []
    );

    if (!updatedSession) {
      return res.status(404).json({ error: 'Sesi ujian tidak aktif atau telah kedaluwarsa' });
    }

    res.json({ success: true, status: updatedSession.status });
  });

  // Anti-Cheat Violation Report (AI Webcam / Window Event)
  app.post('/api/exam/report-cheat', (req, res) => {
    const { sessionId, studentId, studentName, type, description, severity, snapshotUrl } = req.body;

    const log = {
      id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: sessionId || 'sess_general',
      studentId: studentId || 'std_unknown',
      studentName: studentName || 'Peserta',
      timestamp: new Date().toISOString(),
      type: type || 'TAB_SWITCH',
      description: description || 'Terdeteksi perilaku tidak wajar saat ujian',
      severity: severity || 'medium',
      snapshotUrl,
    };

    // Save in Redis session & DB cheat logs
    const stats = redisSessionManager.recordCheatViolation(log);
    dbRepository.addCheatLog(log);

    res.json({
      success: true,
      cheatScore: stats.cheatScore,
      totalCheatCount: stats.totalCheatCount,
    });
  });

  // Final Exam Submission & Automatic Grading (Multiple Choice + Gemini AI Essay)
  app.post('/api/exam/submit', async (req, res) => {
    try {
      const { sessionId, examId, studentId, answers } = req.body;
      const allExams = [...dbRepository.getExams(false), ...dbRepository.getExams(true)];
      const exam = allExams.find((e) => e.id === examId);
      const allStudents = [...dbRepository.getStudents(false), ...dbRepository.getStudents(true)];
      const student = allStudents.find((s) => s.id === studentId);
      const allQuestions = [...dbRepository.getQuestions(false), ...dbRepository.getQuestions(true)];

      if (!exam || !student) {
        return res.status(404).json({ error: 'Ujian atau Data Siswa tidak ditemukan' });
      }

      // Filter questions in this exam
      const questions = exam.questionIds
        .map((qid) => allQuestions.find((q) => q.id === qid))
        .filter((q): q is Question => Boolean(q));

      const activeQuestions = questions.length > 0 ? questions : allQuestions.filter((q) => q.level === exam.level).slice(0, 10);

      let totalEarnedScore = 0;
      let totalPossibleScore = 0;
      let correctCount = 0;

      const soloStats: Record<SOLOLevel, { total: number; correct: number; percentage: number }> = {
        Prestructural: { total: 0, correct: 0, percentage: 100 },
        Unistructural: { total: 0, correct: 0, percentage: 100 },
        Multistructural: { total: 0, correct: 0, percentage: 100 },
        Relational: { total: 0, correct: 0, percentage: 100 },
        'Extended Abstract': { total: 0, correct: 0, percentage: 100 },
      };

      const essayGradingDetails: Record<string, any> = {};

      for (const q of activeQuestions) {
        const studentAns = answers?.[q.id];
        const qWeight = q.weight || 10;
        totalPossibleScore += qWeight;

        if (!soloStats[q.soloLevel]) {
          soloStats[q.soloLevel] = { total: 0, correct: 0, percentage: 100 };
        }
        soloStats[q.soloLevel].total += 1;

        if (q.type === 'pilihan_ganda') {
          if (studentAns === q.correctAnswer) {
            correctCount += 1;
            totalEarnedScore += qWeight;
            soloStats[q.soloLevel].correct += 1;
          }
        } else if (q.type === 'pilihan_ganda_kompleks') {
          // Check array match
          const target = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
          const studentArr = Array.isArray(studentAns) ? studentAns : [studentAns];
          const isMatch = target.length === studentArr.length && target.every((t) => studentArr.includes(t));
          if (isMatch) {
            correctCount += 1;
            totalEarnedScore += qWeight;
            soloStats[q.soloLevel].correct += 1;
          }
        } else if (q.type === 'uraian') {
          // AI Essay Grading
          const textAnswer = String(studentAns || '').trim();
          if (textAnswer.length > 0) {
            const aiGrade = await gradeEssayWithAI({
              questionText: q.questionText,
              studentAnswer: textAnswer,
              keyAnswer: String(q.correctAnswer || ''),
              maxScore: qWeight,
              soloLevel: q.soloLevel,
            });
            totalEarnedScore += aiGrade.score;
            if (aiGrade.score >= qWeight * 0.7) {
              correctCount += 1;
              soloStats[q.soloLevel].correct += 1;
            }
            essayGradingDetails[q.id] = aiGrade;
          }
        }
      }

      // Calculate percentage solo stats
      for (const level of Object.keys(soloStats) as SOLOLevel[]) {
        if (soloStats[level].total > 0) {
          soloStats[level].percentage = Math.round((soloStats[level].correct / soloStats[level].total) * 100);
        }
      }

      const finalNormalizedScore = totalPossibleScore > 0 ? Math.round((totalEarnedScore / totalPossibleScore) * 100) : 0;
      const cheatLogs = redisSessionManager.getCheatLogs(sessionId);
      let cheatScore = 0;
      for (const log of cheatLogs) {
        if (log.severity === 'high') cheatScore += 25;
        else if (log.severity === 'medium') cheatScore += 15;
        else cheatScore += 5;
      }
      cheatScore = Math.min(100, cheatScore);

      const examResult: ExamResult = {
        id: `res_${Date.now()}`,
        sessionId,
        examId: exam.id,
        examTitle: exam.title,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        className: student.className,
        subject: exam.subject,
        totalQuestions: activeQuestions.length,
        correctCount,
        score: finalNormalizedScore,
        passed: finalNormalizedScore >= exam.passingScore,
        essayGradingDetails: Object.keys(essayGradingDetails).length > 0 ? essayGradingDetails : undefined,
        soloPerformance: soloStats,
        cheatScore,
        totalViolations: cheatLogs.length,
        completedAt: new Date().toISOString(),
        isDummy: exam.isDummy,
      };

      const savedResult = dbRepository.addResult(examResult);

      res.json({
        success: true,
        result: savedResult,
      });
    } catch (err: any) {
      console.error('Submit exam error:', err);
      res.status(500).json({ error: err.message || 'Gagal menyimpan dan menilai ujian' });
    }
  });

  // ==========================================
  // REAL-TIME MONITORING APIS FOR TEACHER
  // ==========================================
  app.get('/api/monitor/active-sessions', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const active = redisSessionManager.getAllActiveSessions().filter((s) => s.isDummy === isDummy);
    const recentLogs = dbRepository.getCheatLogs().slice(0, 30);
    res.json({
      activeSessions: active,
      recentCheatLogs: recentLogs,
    });
  });

  app.post('/api/monitor/lock-session', (req, res) => {
    const { sessionId } = req.body;
    const session = redisSessionManager.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    session.status = 'locked';
    res.json({ success: true, message: 'Ujian siswa berhasil dikunci oleh pengawas.' });
  });

  // ==========================================
  // GOOGLE DRIVE BACKUP & DEDUPLICATION APIS
  // ==========================================
  app.get('/api/backup/history', (req, res) => {
    const history = googleDriveBackupService.getBackupHistory();
    const authStatus = googleDriveBackupService.getAuthDiagnostics();
    res.json({
      folderName: googleDriveBackupService.getFolderName(),
      backups: history,
      authStatus,
    });
  });

  app.get('/api/backup/auth-status', (req, res) => {
    res.json(googleDriveBackupService.getAuthDiagnostics());
  });

  app.post('/api/backup/configure-auth', async (req, res) => {
    try {
      const result = await googleDriveBackupService.updateCredentials(req.body);
      res.json({
        success: result.success,
        message: result.message,
        status: result.status,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `Gagal memperbarui konfigurasi: ${err.message}`,
        status: googleDriveBackupService.getAuthDiagnostics(),
      });
    }
  });

  app.post('/api/backup/sync-gdrive', async (req, res) => {
    const state = dbRepository.getState();
    const summary = {
      questions: state.questions.length,
      students: state.students.length,
      exams: state.exams.length,
      results: state.results.length,
    };

    const syncResult = await googleDriveBackupService.syncDatabaseSnapshot(state, summary);
    res.json(syncResult);
  });

  app.delete('/api/backup/:id', (req, res) => {
    const deleted = googleDriveBackupService.deleteBackup(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Backup not found' });
    res.json({ success: true });
  });

  // ==========================================
  // PARENT NOTIFICATION APIS
  // ==========================================
  app.get('/api/notifications', (req, res) => {
    res.json(dbRepository.getParentNotifications());
  });

  app.post('/api/notifications/generate-monthly', (req, res) => {
    const isDummy = req.query.mode === 'dummy';
    const students = dbRepository.getStudents(isDummy);
    const results = dbRepository.getResults(isDummy);
    const monthYear = req.body.monthYear || 'September 2026';

    const generated: any[] = [];
    for (const student of students) {
      const studentResults = results.filter((r) => r.studentId === student.id);
      const avgScore =
        studentResults.length > 0
          ? Math.round(studentResults.reduce((acc, curr) => acc + curr.score, 0) / studentResults.length)
          : 85;

      const violations = studentResults.reduce((acc, curr) => acc + curr.totalViolations, 0);
      const integrityStatus =
        violations === 0 ? 'Sangat Berintegritas (0 Pelanggaran)' : `Perlu Pemantauan (${violations} Peringatan Sistem)`;

      const msg = `Yth. Bapak/Ibu Wali dari *${student.name}* (${student.className}),
Berikut kami sampaikan Ringkasan Perkembangan Akademik & Ujian Periode ${monthYear} dari SMA Negeri 1 Nusantara:
- Rata-rata Skor Ujian: *${avgScore} / 100*
- Jumlah Ujian Diikuti: *${studentResults.length} Ujian*
- Indeks Integritas Ujian: *${integrityStatus}*
- Catatan Guru: ${avgScore >= 75 ? 'Ananda menunjukkan penguasaan materi yang baik dan tuntas.' : 'Perlu bimbingan tambahan dan mengikuti jadwal remedial terjadwal.'}

Terima kasih atas kerja sama dan pendampingan di rumah.
Hormat kami,
Tim Penguji & Kurikulum UjianPro`;

      const notif = dbRepository.addParentNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        monthYear,
        avgScore,
        examsCompleted: studentResults.length,
        cheatIndexSummary: integrityStatus,
        status: 'draft',
        sentVia: 'WhatsApp',
        messageContent: msg,
      });
      generated.push(notif);
    }

    res.json({
      success: true,
      message: `Berhasil membuat ${generated.length} draf notifikasi perkembangan siswa.`,
      notifications: generated,
    });
  });

  app.post('/api/notifications/:id/send', (req, res) => {
    const updated = dbRepository.updateParentNotification(req.params.id, {
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json(updated);
  });

  // Fallback for unmatched API routes - ALWAYS return JSON error, NEVER HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Endpoint API ${req.method} ${req.path} tidak ditemukan` });
  });

  // ==========================================
  // VITE DEV / PRODUCTION MIDDLEWARE
  // ==========================================
  async function startServer() {
    if (process.env.VERCEL) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[UjianPro AI] Server running smoothly at http://localhost:${PORT}`);
    });
  }

  if (!process.env.VERCEL) {
    startServer().catch((err) => {
      console.error('Failed to start UjianPro server:', err);
    });
  }

  export default app;
