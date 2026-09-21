import React from 'react';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import type { Question, SchoolProfile, Exam } from '../types.js';

interface PrintableExamSheetProps {
  exam: Exam;
  questions: Question[];
  schoolProfile: SchoolProfile;
  onBack: () => void;
}

export const PrintableExamSheet: React.FC<PrintableExamSheetProps> = ({
  exam,
  questions,
  schoolProfile,
  onBack,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-100 min-h-screen py-6 px-4">
      {/* Control Action Bar */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Bank Soal</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Format: Kertas A4 Standar Dinas</span>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Lembar Soal (PDF)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (Simulates Standard A4 White Paper) */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 text-black">
        {/* KOP SURAT RESMI SEKOLAH */}
        <div className="flex items-center justify-between border-b-4 border-double border-black pb-4 mb-6">
          {/* Logo Sekolah */}
          <div className="w-20 h-20 shrink-0 flex items-center justify-center">
            {schoolProfile.logoUrl ? (
              <img
                src={schoolProfile.logoUrl}
                alt="Logo Sekolah"
                className="max-h-20 max-w-20 object-contain"
              />
            ) : (
              <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center font-bold text-xs">
                LOGO
              </div>
            )}
          </div>

          {/* Teks Identitas Instansi */}
          <div className="text-center flex-1 px-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider leading-tight">
              {schoolProfile.dinasHeader}
            </h4>
            <h3 className="text-xs font-bold uppercase tracking-wider leading-tight">
              {schoolProfile.subHeader}
            </h3>
            <h1 className="text-lg font-black uppercase tracking-normal my-0.5 leading-tight">
              {schoolProfile.name}
            </h1>
            <p className="text-[11px] leading-tight">
              {schoolProfile.address}, {schoolProfile.city} {schoolProfile.postalCode}
            </p>
            <p className="text-[10px] text-slate-700 leading-tight">
              Telp: {schoolProfile.phone} | Email: {schoolProfile.email} | Web: {schoolProfile.website}
            </p>
            <p className="text-[10px] font-bold mt-0.5">{schoolProfile.accreditation}</p>
          </div>

          <div className="w-20 shrink-0 text-right text-[10px] font-mono">
            <span>TA: {schoolProfile.academicYear}</span>
          </div>
        </div>

        {/* NAMA UJIAN & IDENTITAS MAPEL */}
        <div className="text-center my-4">
          <h2 className="text-base font-extrabold uppercase underline tracking-wide">
            {exam.title}
          </h2>
          <p className="text-xs font-semibold mt-1">
            Mata Pelajaran: {exam.subject} | Jenjang/Tingkat: {exam.level} ({exam.grade}) | Alokasi Waktu: {exam.durationMinutes} Menit
          </p>
        </div>

        {/* ISIAN IDENTITAS PESERTA */}
        <div className="border border-black rounded-md p-3 mb-6 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-semibold inline-block w-28">Nama Peserta</span>: ..............................................................
          </div>
          <div>
            <span className="font-semibold inline-block w-28">Nomor Peserta / NISN</span>: ..............................................................
          </div>
          <div>
            <span className="font-semibold inline-block w-28">Kelas / Ruang</span>: ..............................................................
          </div>
          <div>
            <span className="font-semibold inline-block w-28">Tanda Tangan</span>: ..............................................................
          </div>
        </div>

        {/* PETUNJUK UMUM */}
        <div className="mb-6 p-3 bg-slate-50 border border-slate-300 rounded-md text-[11px] leading-relaxed">
          <span className="font-bold uppercase block mb-1">Petunjuk Umum:</span>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Tuliskan identitas Anda secara lengkap dan jelas pada lembar jawaban yang tersedia.</li>
            <li>Periksa dan bacalah setiap butir soal dengan teliti sebelum Anda menjawabnya.</li>
            <li>Laporkan kepada pengawas ujian jika terdapat tulisan yang kurang jelas, rusak, atau jumlah soal kurang.</li>
            <li>Dilarang menggunakan kalkulator, gawai elektronik, atau alat bantu lainnya kecuali diperkenankan.</li>
          </ol>
        </div>

        {/* DAFTAR BUTIR SOAL */}
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id} className="text-xs leading-relaxed break-inside-avoid">
              <div className="flex items-start space-x-2">
                <span className="font-bold shrink-0">{idx + 1}.</span>
                <div className="flex-1">
                  <p className="font-normal whitespace-pre-line mb-2">{q.questionText}</p>

                  {/* Diagram / Gambar Soal */}
                  {q.imageUrl && (
                    <div className="my-2 max-w-sm">
                      <img
                        src={q.imageUrl}
                        alt={`Ilustrasi Soal ${idx + 1}`}
                        className="max-h-48 rounded border border-slate-300 object-contain"
                      />
                    </div>
                  )}

                  {/* Opsi Pilihan Ganda */}
                  {q.type === 'pilihan_ganda' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2 mt-2">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        return (
                          <div key={opt.id} className="flex items-start space-x-1.5">
                            <span className="font-semibold">{letter}.</span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Uraian Lines */}
                  {q.type === 'uraian' && (
                    <div className="mt-3 pl-2 space-y-2">
                      <div className="border-b border-dotted border-slate-400 h-5" />
                      <div className="border-b border-dotted border-slate-400 h-5" />
                      <div className="border-b border-dotted border-slate-400 h-5" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TANDA TANGAN KEPALA SEKOLAH & GURU PENGUJI */}
        <div className="mt-12 pt-6 border-t border-black flex justify-between text-xs break-inside-avoid">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-semibold">Kepala Sekolah {schoolProfile.name}</p>
            <div className="h-16" />
            <p className="font-bold underline">{schoolProfile.headmasterName}</p>
            <p>NIP. {schoolProfile.headmasterNip}</p>
          </div>

          <div className="text-center">
            <p>{schoolProfile.city}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-semibold">Guru Mata Pelajaran / Penguji</p>
            <div className="h-16" />
            <p className="font-bold underline">Tim Kurikulum {exam.subject}</p>
            <p>NIP. ....................................................</p>
          </div>
        </div>
      </div>
    </div>
  );
};
