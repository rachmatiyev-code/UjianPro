import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Flag,
  ArrowRight,
  ArrowLeft,
  Send,
  Sparkles,
  Shield,
  FileText,
  Award,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import { CheatMonitorWebcam } from './CheatMonitorWebcam.js';
import type { Question, ExamResult, SOLOLevel } from '../types.js';

interface ExamModeProps {
  dataMode: 'dummy' | 'real';
}

export const ExamMode: React.FC<ExamModeProps> = ({ dataMode }) => {
  // Login State
  const [tokenInput, setTokenInput] = useState<string>('');
  const [nisnInput, setNisnInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Exam Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [examMeta, setExamMeta] = useState<any | null>(null);
  const [studentMeta, setStudentMeta] = useState<any | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [doubtfulIds, setDoubtfulIds] = useState<string[]>([]);
  const [cheatScore, setCheatScore] = useState<number>(0);

  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Completed Result State
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Quick Preset Samples for Testing
  const quickFillSample = (token: string, nisn: string) => {
    setTokenInput(token);
    setNisnInput(nisn);
    setErrorMessage(null);
  };

  // Verify Token & Start Exam
  const handleStartExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tokenInput.trim() || !nisnInput.trim()) {
      setErrorMessage('Harap masukkan Token Ujian dan NISN siswa.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/exam/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput, nisn: nisnInput }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memulai ujian');
      }

      setActiveSessionId(data.sessionId);
      setExamMeta(data.exam);
      setStudentMeta(data.student);
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setDoubtfulIds([]);
      setCheatScore(0);
      setSecondsRemaining((data.exam.durationMinutes || 60) * 60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memverifikasi token.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (!activeSessionId || examResult) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSessionId, examResult]);

  // Periodic Heartbeat Sync with Redis
  useEffect(() => {
    if (!activeSessionId || examResult) return;

    const interval = setInterval(async () => {
      try {
        await fetch('/api/exam/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            currentQuestionIndex: currentIndex,
            answers,
            doubtfulQuestionIds: doubtfulIds,
          }),
        });
      } catch (e) {
        console.warn('Heartbeat sync warning:', e);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeSessionId, currentIndex, answers, doubtfulIds, examResult]);

  // Handle Anti-Cheat Violation Report
  const handleCheatViolation = async (type: string, description: string, severity: 'low' | 'medium' | 'high') => {
    if (!activeSessionId) return;

    try {
      const res = await fetch('/api/exam/report-cheat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          studentId: studentMeta?.id,
          studentName: studentMeta?.name,
          type,
          description,
          severity,
        }),
      });
      const data = await res.json();
      if (data.cheatScore !== undefined) {
        setCheatScore(data.cheatScore);
      }
    } catch (e) {
      console.error('Failed to report cheat violation:', e);
    }
  };

  // Submit Exam
  const handleSubmitExam = async () => {
    if (!activeSessionId || !examMeta || !studentMeta) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          examId: examMeta.id,
          studentId: studentMeta.id,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirimkan lembar ujian');
      }

      setExamResult(data.result);
      setActiveSessionId(null);
    } catch (err: any) {
      alert(`Gagal mengirimkan ujian: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];

  // Helper formatting for seconds to HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleDoubtful = (qId: string) => {
    setDoubtfulIds((prev) => (prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]));
  };

  // ==========================================
  // VIEW 1: TOKEN & NISN ENTRY (LOGIN SCREEN)
  // ==========================================
  if (!activeSessionId && !examResult) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-3 ring-8 ring-indigo-50/50">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portal Ujian CBT Online</h1>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan Token Ujian dan NISN untuk mengakses lembar soal terenkripsi
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleStartExam} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Token Ujian (6 Karakter)
              </label>
              <input
                id="input-exam-token"
                type="text"
                placeholder="Contoh: FIS12A atau BIO11X"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                maxLength={10}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NISN (Nomor Induk Siswa Nasional)
              </label>
              <input
                id="input-student-nisn"
                type="text"
                placeholder="Contoh: 0071234501"
                value={nisnInput}
                onChange={(e) => setNisnInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="pt-2">
              <button
                id="btn-login-exam"
                type="submit"
                disabled={isVerifying}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <span>Memverifikasi Token &amp; Kamera...</span>
                ) : (
                  <>
                    <span>Mulai Kerjakan Ujian</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Fill Buttons for Fast Testing */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 block mb-2">
              Akun Demo Cepat (Klik untuk Mengisi Otomatis):
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => quickFillSample('FIS12A', '0071234501')}
                className="text-left p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800">Ahmad Fadhil (XII MIPA 1)</div>
                  <div className="text-[10px] text-slate-500">PTS Fisika Terpadu | Token: <span className="font-mono text-indigo-600 font-bold">FIS12A</span></div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => quickFillSample('IPA09B', '0071234502')}
                className="text-left p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800">Siti Nurhaliza (SMP / AKM)</div>
                  <div className="text-[10px] text-slate-500">Simulasi SOLO IPA | Token: <span className="font-mono text-indigo-600 font-bold">IPA09B</span></div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: COMPLETED EXAM RESULT
  // ==========================================
  if (examResult) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
          <div className="text-center pb-6 border-b border-slate-100">
            <div
              className={`inline-flex p-4 rounded-3xl ${
                examResult.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              } mb-3`}
            >
              <Award className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Ujian Telah Selesai</h2>
            <p className="text-xs text-slate-500 mt-1">
              Hasil penilaian otomatis dan analisis taksonomi SOLO telah berhasil dihitung.
            </p>
          </div>

          {/* Score & Integrity Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-xs font-semibold text-slate-500">Skor Akhir</span>
              <div className="text-3xl font-extrabold text-indigo-600 mt-1">{examResult.score}</div>
              <span
                className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  examResult.passed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {examResult.passed ? 'LULUS (Di Atas KKM)' : 'REMEDIAL'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-xs font-semibold text-slate-500">Soal Dijawab Benar</span>
              <div className="text-3xl font-extrabold text-slate-800 mt-1">
                {examResult.correctCount} / {examResult.totalQuestions}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Tingkat Ketepatan</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-xs font-semibold text-slate-500">Indeks Integritas AI</span>
              <div
                className={`text-3xl font-extrabold mt-1 ${
                  examResult.cheatScore === 0
                    ? 'text-emerald-600'
                    : examResult.cheatScore < 30
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {100 - examResult.cheatScore}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {examResult.totalViolations} Insiden Terdeteksi
              </span>
            </div>
          </div>

          {/* SOLO Taxonomy Performance Mastery */}
          <div className="mb-6 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-xs text-indigo-950 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Analisis Capaian Berdasarkan Taksonomi SOLO
              </span>
              <span className="text-[11px] text-indigo-600 font-semibold">Pedoman Asesmen</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(examResult.soloPerformance || {}).map(([level, data]) => {
                if (data.total === 0) return null;
                return (
                  <div key={level} className="text-xs">
                    <div className="flex justify-between text-slate-700 font-medium mb-1">
                      <span>{level}</span>
                      <span>
                        {data.correct}/{data.total} ({data.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${data.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Essay Feedback (If applicable) */}
          {examResult.essayGradingDetails && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
              <span className="font-bold text-xs text-amber-900 block mb-2">
                Umpan Balik AI Gemini (Penilaian Soal Uraian):
              </span>
              {Object.entries(examResult.essayGradingDetails).map(([qid, detail]: any) => (
                <div key={qid} className="text-xs text-slate-700 space-y-1 mb-2 bg-white p-3 rounded-lg border border-amber-100">
                  <div className="font-semibold text-amber-800">Skor Diperoleh: {detail.score} poin</div>
                  <p className="text-slate-600 italic">"{detail.feedback}"</p>
                  <p className="text-[11px] text-slate-500 font-medium">{detail.rubricEvaluated}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => {
                setExamResult(null);
                setTokenInput('');
                setNisnInput('');
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20"
            >
              Kembali ke Halaman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: ACTIVE EXAM HALL (ROOM)
  // ==========================================
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 flex flex-col">
      {/* Top Exam Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold uppercase tracking-wide">
              {examMeta?.subject}
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">{examMeta?.title}</h2>
              <p className="text-[11px] text-slate-500">
                Peserta: <strong className="text-slate-700">{studentMeta?.name}</strong> ({studentMeta?.className}) | NISN: {studentMeta?.nisn}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Timer Counter */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                secondsRemaining < 300
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Sisa Waktu: {formatTimer(secondsRemaining)}</span>
            </div>

            {/* Finish Button */}
            <button
              id="btn-finish-exam-trigger"
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Selesai Ujian</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Examination Workspace */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: AI Proctoring Webcam & Question Grid Navigation */}
        <div className="lg:col-span-4 space-y-4">
          <CheatMonitorWebcam
            sessionId={activeSessionId!}
            studentId={studentMeta?.id}
            studentName={studentMeta?.name}
            onViolation={handleCheatViolation}
            cheatScore={cheatScore}
          />

          {/* Question Matrix Drawer */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-xs text-slate-800">Navigasi Nomor Soal</span>
              <span className="text-[11px] text-slate-500 font-medium">
                {Object.keys(answers).length} dari {questions.length} Terjawab
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
                const isDoubtful = doubtfulIds.includes(q.id);
                const isCurrent = idx === currentIndex;

                let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                if (isCurrent) {
                  btnClass = 'ring-2 ring-indigo-600 bg-indigo-600 text-white font-bold';
                } else if (isDoubtful) {
                  btnClass = 'bg-amber-400 text-amber-950 font-bold border-amber-500';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-500 text-white font-bold border-emerald-600';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span>Terjawab</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                <span>Ragu-ragu</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block" />
                <span>Belum</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Question Content & Options */}
        <div className="lg:col-span-8 flex flex-col">
          {currentQ ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                {/* Question Header Meta */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">
                      Soal Nomor {currentIndex + 1}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Bobot: {currentQ.weight || 10} Poin
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      SOLO: {currentQ.soloLevel}
                    </span>
                    {currentQ.bloomLevel && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Bloom: {currentQ.bloomLevel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Stimulus & Text */}
                <div className="text-slate-900 text-sm sm:text-base leading-relaxed mb-6 whitespace-pre-line font-medium">
                  {currentQ.questionText}
                </div>

                {/* Optional Attached Diagram / Image */}
                {currentQ.imageUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 max-w-lg bg-slate-50">
                    <img
                      src={currentQ.imageUrl}
                      alt="Ilustrasi Soal Ujian"
                      className="w-full max-h-72 object-contain"
                    />
                  </div>
                )}

                {/* Answer Options */}
                {currentQ.type === 'pilihan_ganda' && currentQ.options && (
                  <div className="space-y-3">
                    {currentQ.options.map((opt, i) => {
                      const optLetter = String.fromCharCode(65 + i); // A, B, C, D...
                      const isSelected = answers[currentQ.id] === opt.id;

                      return (
                        <label
                          key={opt.id}
                          className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                              : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`opt_${currentQ.id}`}
                            checked={isSelected}
                            onChange={() => setAnswers({ ...answers, [currentQ.id]: opt.id })}
                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {optLetter}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-800 leading-normal">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Complex Multiple Choice (Checkboxes) */}
                {currentQ.type === 'pilihan_ganda_kompleks' && currentQ.options && (
                  <div className="space-y-3">
                    <span className="text-xs text-slate-500 block mb-1 italic">
                      * Pilih satu atau lebih jawaban yang benar:
                    </span>
                    {currentQ.options.map((opt, i) => {
                      const optLetter = String.fromCharCode(65 + i);
                      const currentAnswers: string[] = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                      const isSelected = currentAnswers.includes(opt.id);

                      const handleCheckbox = () => {
                        const updated = isSelected
                          ? currentAnswers.filter((id) => id !== opt.id)
                          : [...currentAnswers, opt.id];
                        setAnswers({ ...answers, [currentQ.id]: updated });
                      };

                      return (
                        <label
                          key={opt.id}
                          onClick={handleCheckbox}
                          className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                              : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500 rounded"
                          />
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {optLetter}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-800 leading-normal">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Essay / Uraian Textarea */}
                {currentQ.type === 'uraian' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tuliskan Uraian Jawaban Lengkap Anda:
                    </label>
                    <textarea
                      rows={6}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                      placeholder="Uraikan jawaban berdasarkan penalaran logis Anda..."
                      className="w-full p-4 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="text-right text-[11px] text-slate-400">
                      Jumlah Karakter: {String(answers[currentQ.id] || '').length}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Controls Bar */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all disabled:opacity-40 flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <button
                  onClick={() => toggleDoubtful(currentQ.id)}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                    doubtfulIds.includes(currentQ.id)
                      ? 'bg-amber-400 text-amber-950 border-amber-500 font-bold'
                      : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ragu-Ragu</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
                  >
                    <span>Selanjutnya</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
                  >
                    <span>Kumpulkan</span>
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
              Belum ada soal terlampir pada paket ujian ini.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal Before Submission */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Konfirmasi Pengumpulan Ujian</h3>
            <p className="text-xs text-slate-600 mb-4">
              Apakah Anda yakin ingin menyelesaikan dan mengirimkan lembar jawaban?
            </p>

            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Total Soal:</span>
                <span className="font-bold">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Soal Terjawab:</span>
                <span className="font-bold text-emerald-600">{Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Ditandai Ragu-Ragu:</span>
                <span className="font-bold text-amber-600">{doubtfulIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Belum Terjawab:</span>
                <span className="font-bold text-rose-600">
                  {questions.length - Object.keys(answers).length}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Periksa Kembali
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
              >
                {isSubmitting ? 'Mengirimkan & Menilai...' : 'Ya, Kumpulkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
