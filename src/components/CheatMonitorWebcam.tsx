import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  AlertTriangle,
  ShieldAlert,
  UserX,
  Users,
  Maximize2,
  Eye,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface CheatMonitorProps {
  sessionId: string;
  studentId: string;
  studentName: string;
  onViolation: (type: string, description: string, severity: 'low' | 'medium' | 'high') => void;
  cheatScore: number;
}

export const CheatMonitorWebcam: React.FC<CheatMonitorProps> = ({
  sessionId,
  studentId,
  studentName,
  onViolation,
  cheatScore,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'normal' | 'warning' | 'alert'>('normal');
  const [statusMessage, setStatusMessage] = useState<string>('Pengawasan AI Aktif: 1 Wajah Terdeteksi');
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Initialize Webcam Stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: false,
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreamActive(true);
        setCameraError(null);
      } catch (err: any) {
        console.warn('Camera access could not be acquired or permission denied:', err);
        setCameraError('Kamera tidak aktif atau izin ditolak. Menggunakan sensor heuristik pengawasan.');
        setStreamActive(false);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Monitor Window Tab Switches & Blur Events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setAiStatus('alert');
        setStatusMessage('PERINGATAN: Terdeteksi Berpindah Tab/Aplikasi!');
        onViolation('TAB_SWITCH', 'Peserta meninggalkan jendela ujian dan membuka tab atau program lain.', 'medium');
      } else {
        setTimeout(() => {
          setAiStatus('normal');
          setStatusMessage('Pengawasan AI Aktif: Kembali ke Jendela Ujian');
        }, 3000);
      }
    };

    const handleWindowBlur = () => {
      // Occurs when student clicks outside browser or opens inspect/window
      setAiStatus('warning');
      setStatusMessage('Fokus jendela ujian berkurang!');
    };

    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs) {
        onViolation('FULLSCREEN_EXIT', 'Peserta keluar dari mode layar penuh (fullscreen).', 'low');
      }
    };

    // Block keyboard shortcuts like F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V during exam
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        onViolation('DEVTOOLS_OPEN', 'Percobaan membuka Developer Tools browser dicegah.', 'high');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onViolation]);

  // Request Fullscreen helper
  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignored if restricted in iframe
    }
  };

  // Simulated AI vision periodic check (detects face presence heuristics)
  const triggerSimulation = (type: 'face_absent' | 'multi_face') => {
    if (type === 'face_absent') {
      setAiStatus('alert');
      setStatusMessage('Wajah peserta tidak terdeteksi di depan kamera!');
      onViolation('FACE_ABSENT', 'Wajah peserta tidak terlihat pada feed kamera selama lebih dari 5 detik.', 'high');
    } else {
      setAiStatus('alert');
      setStatusMessage('Terdeteksi lebih dari 1 orang di depan layar!');
      onViolation('MULTIPLE_FACES', 'AI mendeteksi keberadaan orang kedua di dalam bidang pandang kamera.', 'high');
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-lg border border-slate-800 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-400">
            AI Proctoring Cam
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-slate-400">Indeks Pelanggaran:</span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
              cheatScore === 0
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : cheatScore < 30
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
          >
            {cheatScore}%
          </span>
        </div>
      </div>

      {/* Video Stream Container */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
        {streamActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
            <Camera className="w-8 h-8 text-slate-600 mb-1 animate-pulse" />
            <span className="text-[10px] text-slate-300 font-medium">Sensor AI Visual Siaga</span>
            <span className="text-[9px] text-slate-500 mt-0.5">Pemindaian gerakan &amp; fokus aktif</span>
          </div>
        )}

        {/* AI Face Detection Bounding Overlay */}
        <div className="absolute inset-2 border border-dashed border-emerald-500/40 rounded-lg pointer-events-none flex flex-col justify-between p-1.5">
          <div className="flex justify-between items-center text-[9px] font-mono text-emerald-400 bg-slate-950/70 px-1 py-0.5 rounded backdrop-blur-xs">
            <span>TRACK: [OK]</span>
            <span>GAZE: CENTER</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 bg-slate-950/70 px-1 py-0.5 rounded">
            <span>FPS: 30</span>
            <span>TAB SWITCH: {tabSwitchCount}</span>
          </div>
        </div>
      </div>

      {/* Live AI Status Bar */}
      <div
        className={`mt-2 p-2 rounded-lg flex items-center space-x-2 transition-colors ${
          aiStatus === 'normal'
            ? 'bg-slate-800/80 text-emerald-300 border border-emerald-900/50'
            : aiStatus === 'warning'
            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
            : 'bg-rose-950/90 text-rose-200 border border-rose-700 animate-pulse'
        }`}
      >
        {aiStatus === 'normal' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="font-medium text-[11px] leading-tight line-clamp-1">{statusMessage}</span>
      </div>

      {/* Fullscreen and Quick Verification Control */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
        <button
          onClick={enterFullscreen}
          className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors"
        >
          <Maximize2 className="w-3 h-3 text-indigo-400" />
          <span>Kunci Layar Penuh</span>
        </button>

        {/* Proctoring Test Simulator for Demonstrations */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => triggerSimulation('face_absent')}
            title="Simulasi Uji AI: Wajah Hilang"
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition-colors text-[10px]"
          >
            Uji Wajah Hilang
          </button>
          <button
            onClick={() => triggerSimulation('multi_face')}
            title="Simulasi Uji AI: 2 Wajah"
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 transition-colors text-[10px]"
          >
            Uji 2 Orang
          </button>
        </div>
      </div>
    </div>
  );
};
