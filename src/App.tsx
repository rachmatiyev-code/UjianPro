import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { ExamMode } from './components/ExamMode.js';
import { TeacherDashboard } from './components/TeacherDashboard.js';
import type { SchoolProfile, SystemStatus } from './types.js';

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'teacher'>('student');
  const [dataMode, setDataMode] = useState<'dummy' | 'real'>('dummy');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>({
    name: 'SMA Negeri 1 Nusantara',
    dinasHeader: 'PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA',
    subHeader: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
    address: 'Jl. Merdeka Pendidikan No. 45, Kebayoran Baru',
    city: 'Jakarta Selatan',
    postalCode: '12180',
    phone: '(021) 78901234',
    email: 'info@sman1nusantara.sch.id',
    website: 'https://sman1nusantara.sch.id',
    accreditation: 'TERAKREDITASI A (UNGGUL)',
    headmasterName: 'Dr. H. Bambang Sudirman, M.Pd.',
    headmasterNip: '19750812 200003 1 002',
    academicYear: '2025/2026',
    logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=160&auto=format&fit=crop&q=80',
  });

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.warn('System status fetch warning:', e);
    }
  };

  const fetchSchoolProfile = async () => {
    try {
      const res = await fetch('/api/school-profile');
      if (res.ok) {
        const data = await res.json();
        setSchoolProfile(data);
      }
    } catch (e) {
      console.warn('School profile fetch warning:', e);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    fetchSchoolProfile();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Navigation Header */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        dataMode={dataMode}
        onDataModeChange={setDataMode}
        systemStatus={systemStatus}
        onRefreshStatus={fetchSystemStatus}
        schoolName={schoolProfile.name}
      />

      {/* Main Screen Router */}
      <main className="flex-1">
        {currentView === 'student' ? (
          <ExamMode dataMode={dataMode} />
        ) : (
          <TeacherDashboard
            dataMode={dataMode}
            schoolProfile={schoolProfile}
            onUpdateSchoolProfile={setSchoolProfile}
          />
        )}
      </main>

      {/* Persistent Bottom System Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">UjianPro AI v2.4</span>
            <span>•</span>
            <span>CBT Engine + AI Proctoring</span>
            <span>•</span>
            <span className="text-indigo-600 font-medium">Sintaks Taksonomi SOLO</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-slate-600">
              Penyimpanan: <strong className="text-slate-800">PostgreSQL Relasional</strong>
            </span>
            <span>•</span>
            <span className="text-slate-600">
              Sesi: <strong className="text-slate-800">Redis TTL</strong>
            </span>
            <span>•</span>
            <span className="text-slate-600">
              Backup: <strong className="text-slate-800">GDrive Deduplikasi</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
