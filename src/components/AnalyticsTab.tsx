import React from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Users, 
  GraduationCap, 
  Award, 
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { Room, Student, ValidationSummary, SchoolMetadata } from '../types';
import { exportRoomAllocationToCsv } from '../utils/csvParser';

interface AnalyticsTabProps {
  rooms: Room[];
  students: Student[];
  validation: ValidationSummary;
  metadata: SchoolMetadata;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  rooms,
  students,
  validation,
  metadata
}) => {
  // Extract all origin classes
  const classMap: Record<string, Record<string, number>> = {};
  const allClasses = new Set<string>();

  rooms.forEach(r => {
    r.seats.forEach(s => {
      if (s.student) {
        const c = s.student.kelasAsal;
        allClasses.add(c);
        if (!classMap[c]) classMap[c] = {};
        classMap[c][r.nama] = (classMap[c][r.nama] || 0) + 1;
      }
    });
  });

  const sortedClasses = Array.from(allClasses).sort((a, b) => a.localeCompare(b));

  // Export full CSV
  const handleExportCsv = () => {
    const csvContent = exportRoomAllocationToCsv(rooms);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-alokasi-ruang-${metadata.singkatanUjian.toLowerCase().replace(/\s+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Validation & Quality Assurance Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              validation.status === 'Sempurna' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  Status Kepatuhan Aturan Tempat Duduk:
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  validation.status === 'Sempurna'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {validation.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {validation.pasanganValid} dari {validation.totalPasangan} pasangan meja memenuhi seluruh kriteria silang jenjang dan pemisahan jenis kelamin.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer self-start md:self-auto"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>Ekspor Rekap Lengkap (CSV)</span>
          </button>
        </div>

        {/* Validation Checklist Items */}
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Silang Tingkat / Jenjang</div>
              <div className="text-[11px] text-slate-500">
                {validation.pelanggaranJenjang === 0 ? '100% Berbeda Jenjang' : `${validation.pelanggaranJenjang} Isu`}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Pemisahan Gender (L/P)</div>
              <div className="text-[11px] text-slate-500">
                {validation.pelanggaranGender === 0 ? '100% Pasangan Sejenis (L-L, P-P)' : `${validation.pelanggaranGender} Isu`}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Kapasitas & Meja</div>
              <div className="text-[11px] text-slate-500">
                Maks. 32 siswa/ruang (8 kol x 4 baris)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Tabulation Matrix: Classes vs Rooms */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Matriks Distribusi: Kelas Asal vs Ruangan Ujian
            </h3>
            <p className="text-xs text-slate-500">
              Persebaran siswa dari setiap rombel ke ruang-ruang tes
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            {students.length} Total Siswa
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center border-r border-slate-200">No</th>
                <th className="py-3 px-4 w-24 border-r border-slate-200">Kelas Asal</th>
                {rooms.map(r => (
                  <th key={r.id} className="py-3 px-2.5 text-center border-r border-slate-200">
                    <div className="font-bold">{r.nama.replace('Ruang ', 'R-')}</div>
                    <div className="text-[9px] font-normal text-slate-500">({r.stats.totalSiswa})</div>
                  </th>
                ))}
                <th className="py-3 px-4 text-center font-bold bg-slate-200/70 text-slate-900">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedClasses.map((cls, idx) => {
                let rowTotal = 0;
                return (
                  <tr key={cls} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-200">
                      {cls}
                    </td>
                    {rooms.map(r => {
                      const count = classMap[cls]?.[r.nama] || 0;
                      rowTotal += count;
                      return (
                        <td 
                          key={r.id} 
                          className={`py-2.5 px-2.5 text-center font-mono border-r border-slate-200 ${
                            count > 0 ? 'text-slate-800 font-semibold bg-teal-50/30' : 'text-slate-300'
                          }`}
                        >
                          {count > 0 ? count : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-center font-bold font-mono text-slate-900 bg-slate-100/60">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td colSpan={2} className="py-3 px-4 text-center border-r border-slate-200">
                  TOTAL PESERTA RUANG
                </td>
                {rooms.map(r => (
                  <td key={r.id} className="py-3 px-2.5 text-center font-mono border-r border-slate-200">
                    {r.stats.totalSiswa}
                  </td>
                ))}
                <td className="py-3 px-4 text-center font-mono text-teal-800 bg-teal-100">
                  {students.length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Room Performance & Ability Tiers Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            Analisis Tingkat Nilai & Persebaran Gender per Ruang
          </h3>
          <p className="text-xs text-slate-500">
            Memverifikasi pengelompokan tingkat kemampuan (Ranking tinggi di ruang awal) dan keseimbangan gender
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rooms.map(r => (
            <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="text-sm">{r.nama}</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-mono">
                  Rata-rata: {r.stats.rataRataNilai}
                </span>
              </div>

              {/* Progress bar of Male vs Female */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>Laki-Laki: <strong>{r.stats.lakiLaki}</strong></span>
                  <span>Perempuan: <strong>{r.stats.perempuan}</strong></span>
                </div>
                <div className="w-full h-2 rounded-full bg-pink-200 overflow-hidden flex">
                  <div 
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${(r.stats.lakiLaki / (r.stats.totalSiswa || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Grade distribution */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Kls 7: <strong className="text-slate-700">{r.stats.kelas7}</strong></span>
                <span>Kls 8: <strong className="text-slate-700">{r.stats.kelas8}</strong></span>
                <span>Kls 9: <strong className="text-slate-700">{r.stats.kelas9}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
