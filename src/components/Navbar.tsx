import React from 'react';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Database,
  HardDrive,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import type { SystemStatus } from '../types.js';

interface NavbarProps {
  currentView: 'student' | 'teacher';
  onViewChange: (view: 'student' | 'teacher') => void;
  dataMode: 'dummy' | 'real';
  onDataModeChange: (mode: 'dummy' | 'real') => void;
  systemStatus: SystemStatus | null;
  onRefreshStatus: () => void;
  schoolName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  dataMode,
  onDataModeChange,
  systemStatus,
  onRefreshStatus,
  schoolName = 'SMA Negeri 1 Nusantara',
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-sm ring-2 ring-indigo-100">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  Ujian<span className="text-indigo-600">Pro</span> AI
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <ShieldCheck className="w-3 h-3 mr-1 text-indigo-600" />
                  CBT Proctoring
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                {schoolName}
              </p>
            </div>
          </div>

          {/* Center Mode Switch: Mode Siswa vs Panel Guru */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              id="nav-btn-student-mode"
              onClick={() => onViewChange('student')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'student'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Ruang Ujian Siswa</span>
            </button>
            <button
              id="nav-btn-teacher-mode"
              onClick={() => onViewChange('teacher')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'teacher'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Panel Guru &amp; Admin</span>
            </button>
          </div>

          {/* Right Action Bar: Data Mode Toggle & Infrastructure Status */}
          <div className="flex items-center space-x-3">
            {/* Dummy vs Real Data Isolation Toggle */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
              <button
                id="btn-toggle-dummy-data"
                onClick={() => onDataModeChange('dummy')}
                title="Data Simulasi Ujian & Dummy Bank Soal"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  dataMode === 'dummy'
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Data Demo
              </button>
              <button
                id="btn-toggle-real-data"
                onClick={() => onDataModeChange('real')}
                title="Data Produksi Asli Sekolah"
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  dataMode === 'real'
                    ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Data Asli
              </button>
            </div>

            {/* Infrastructure Pills */}
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              <div
                className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700"
                title="Status PostgreSQL Database"
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Postgres:</span>
                <span className="font-semibold text-emerald-600 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
                  Aktif
                </span>
              </div>

              <div
                className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700"
                title="Redis High-Speed Session & Token Cache"
              >
                <HardDrive className="w-3.5 h-3.5 text-red-500" />
                <span>Redis:</span>
                <span className="font-semibold text-emerald-600">TTL Sesi</span>
              </div>

              <div
                className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700"
                title="Folder Google Drive: UjianOnline_Backups (Deduplikasi Aktif)"
              >
                <Cloud className="w-3.5 h-3.5 text-indigo-500" />
                <span>GDrive:</span>
                <span className="font-medium text-slate-800">UjianOnline_Backups</span>
              </div>
            </div>

            {/* Mobile View Switcher button */}
            <div className="flex md:hidden">
              <button
                onClick={() => onViewChange(currentView === 'student' ? 'teacher' : 'student')}
                className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{currentView === 'student' ? 'Ke Guru' : 'Ke Siswa'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
