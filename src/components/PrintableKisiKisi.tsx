import React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import type { Question, SchoolProfile, Exam } from '../types.js';

interface PrintableKisiKisiProps {
  exam: Exam;
  questions: Question[];
  schoolProfile: SchoolProfile;
  onBack: () => void;
}

export const PrintableKisiKisi: React.FC<PrintableKisiKisiProps> = ({
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
      <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Format: Matriks Kisi-Kisi SOLO Taxonomy</span>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kisi-Kisi (PDF)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-5xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-md border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 text-black text-xs">
        {/* KOP RESMI */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h3 className="font-bold text-xs uppercase">{schoolProfile.dinasHeader}</h3>
          <h2 className="font-extrabold text-sm uppercase">{schoolProfile.name}</h2>
          <p className="text-[10px]">{schoolProfile.address}, {schoolProfile.city}</p>
        </div>

        {/* JUDUL MATRIKS */}
        <div className="text-center mb-5">
          <h1 className="text-sm font-bold uppercase underline">
            KISI-KISI PENULISAN SOAL ASESMEN / UJIAN
          </h1>
          <p className="text-[11px] font-semibold mt-0.5">
            Mata Pelajaran: {exam.subject} | Jenjang: {exam.level} ({exam.grade}) | Tahun Pelajaran: {schoolProfile.academicYear}
          </p>
          <p className="text-[10px] text-slate-600 italic">
            * Berpedoman pada Sintaks Taksonomi SOLO (Structure of Observed Learning Outcomes) &amp; Taksonomi Bloom
          </p>
        </div>

        {/* TABEL KISI-KISI */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-black p-2 w-10">No.</th>
                <th className="border border-black p-2 w-32">Topik / Materi</th>
                <th className="border border-black p-2">Indikator Soal &amp; Stimulus</th>
                <th className="border border-black p-2 w-28">Level SOLO Taxonomy</th>
                <th className="border border-black p-2 w-16">Bloom</th>
                <th className="border border-black p-2 w-20">Bentuk Soal</th>
                <th className="border border-black p-2 w-14">No. Soal</th>
                <th className="border border-black p-2 w-16">Kunci / Bobot</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr key={q.id} className="align-top">
                  <td className="border border-black p-2 text-center font-semibold">{idx + 1}</td>
                  <td className="border border-black p-2 font-medium">{q.topic}</td>
                  <td className="border border-black p-2">
                    <p className="line-clamp-2 mb-1">{q.questionText}</p>
                    <span className="text-[10px] text-slate-600 italic block">
                      Tingkat Penalaran: {q.soloLevel}
                    </span>
                  </td>
                  <td className="border border-black p-2 font-semibold text-center bg-slate-50/50">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 text-[10px]">
                      {q.soloLevel}
                    </span>
                  </td>
                  <td className="border border-black p-2 text-center font-mono font-bold">
                    {q.bloomLevel || 'C3'}
                  </td>
                  <td className="border border-black p-2 text-center capitalize">
                    {q.type.replace('_', ' ')}
                  </td>
                  <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black p-2 text-center">
                    <span className="font-mono font-bold uppercase">
                      {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : String(q.correctAnswer).substring(0, 5)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-normal">
                      ({q.weight || 10} poin)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CATATAN TAKSONOMI SOLO */}
        <div className="mt-4 p-2.5 border border-slate-300 rounded bg-slate-50 text-[10px] space-y-0.5">
          <span className="font-bold block">Keterangan Level Taksonomi SOLO:</span>
          <div>• <strong>Prestructural</strong>: Belum memahami substansi konsep / informasi lepas.</div>
          <div>• <strong>Unistructural</strong>: Mampu menghubungkan 1 aspek sederhana secara eksplisit.</div>
          <div>• <strong>Multistructural</strong>: Menguasai beberapa aspek namun masih terpisah-pisah.</div>
          <div>• <strong>Relational</strong>: Mengintegrasikan seluruh aspek konsep menjadi kesatuan terstruktur yang logis.</div>
          <div>• <strong>Extended Abstract</strong>: Mampu menggeneralisasi konsep terintegrasi ke ranah baru / abstrak / hipotesis.</div>
        </div>

        {/* TANDA TANGAN */}
        <div className="mt-8 pt-4 flex justify-between text-xs break-inside-avoid">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-semibold">Kepala {schoolProfile.name}</p>
            <div className="h-14" />
            <p className="font-bold underline">{schoolProfile.headmasterName}</p>
            <p>NIP. {schoolProfile.headmasterNip}</p>
          </div>

          <div className="text-center">
            <p>{schoolProfile.city}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-semibold">Penyusun Kisi-Kisi &amp; Soal</p>
            <div className="h-14" />
            <p className="font-bold underline">Guru Pengampu {exam.subject}</p>
            <p>NIP. ....................................................</p>
          </div>
        </div>
      </div>
    </div>
  );
};
