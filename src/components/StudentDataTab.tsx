import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, Upload, Download, Plus, Search, Filter, 
  RefreshCw, Edit3, Trash2, ArrowUpDown, X, FileSpreadsheet 
} from 'lucide-react';
import { Student } from '../types';
import { parseFileToStudents, exportStudentsToCsv } from '../utils/csvParser';
import { 
  downloadStudentTemplateExcel, 
  downloadStudentTemplateCsv, 
  exportStudentsToExcel 
} from '../utils/excelTemplate';

interface StudentDataTabProps {
  students: Student[];
  onUpdateStudents: (newStudents: Student[]) => void;
  onResetToInitial: () => void;
}

export const StudentDataTab: React.FC<StudentDataTabProps> = ({ students, onUpdateStudents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState<string>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.nisn.includes(searchQuery);
      const matchKelas = filterKelas === 'all' || s.kelasAsal === filterKelas;
      return matchSearch && matchKelas;
    });
  }, [students, searchQuery, filterKelas]);

  const listKelas = useMemo(() => Array.from(new Set(students.map(s => s.kelasAsal))).sort(), [students]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const parsed = await parseFileToStudents(file);
      if (uploadMode === 'replace') {
        onUpdateStudents(parsed);
      } else {
        onUpdateStudents([...students, ...parsed]);
      }
      setShowUploadModal(false);
    } catch (error: any) {
      alert(`Error parsing file: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleDelete = (id: string) => {
    if (confirm('Hapus siswa ini?')) {
      onUpdateStudents(students.filter(s => s.id !== id));
    }
  };

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA data siswa?')) {
      onUpdateStudents([]);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header Actions - Minimalist */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Data Siswa</h2>
            <p className="text-xs text-slate-500">{students.length} Siswa Terdaftar</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Cari nama / NISN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none w-48 transition-all focus:bg-white"
            />
          </div>
          
          <select 
            value={filterKelas} 
            onChange={e => setFilterKelas(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
          >
            <option value="all">Semua Kelas</option>
            {listKelas.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <button 
            onClick={() => downloadStudentTemplateExcel()} 
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-semibold shadow-xs cursor-pointer" 
            title="Unduh Template Excel (.xlsx) dengan petunjuk lengkap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Template Excel (.xlsx)</span>
            <span className="sm:hidden">Template</span>
          </button>

          <button 
            onClick={() => setShowUploadModal(true)} 
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-xs font-semibold shadow-xs cursor-pointer" 
            title="Import Excel (.xlsx) / CSV"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Siswa</span>
          </button>
          
          <button 
            onClick={() => exportStudentsToExcel(students)} 
            className="p-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer" 
            title="Ekspor ke Excel (.xlsx)"
          >
            <Download className="w-4 h-4 text-emerald-700" />
          </button>

          {students.length > 0 && (
            <button 
              onClick={handleClearAll} 
              className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" 
              title="Hapus Semua Siswa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Data */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">No</th>
                <th className="p-4">NISN / NIS</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4 w-20 text-center">L/P</th>
                <th className="p-4 w-24 text-center">Kelas</th>
                <th className="p-4 w-24 text-center">Nilai</th>
                <th className="p-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto py-6">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-xs">
                        <FileSpreadsheet className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-semibold text-slate-700">Belum Ada Data Siswa</h4>
                      <p className="text-xs text-slate-500 leading-relaxed text-center">
                        Unduh template Excel resmi untuk menyiapkan data siswa lengkap dengan contoh dan petunjuk, lalu upload ke sistem.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <button 
                          onClick={() => downloadStudentTemplateExcel()}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Unduh Template Excel (.xlsx)</span>
                        </button>
                        <button 
                          onClick={() => setShowUploadModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Import File</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
                    <td className="p-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{s.nisn || '-'}</div>
                      <div className="text-xs text-slate-400">{s.nis ? `NIS: ${s.nis}` : ''}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{s.nama}</div>
                      {s.asalSekolah && (
                        <div className="text-xs text-slate-400 mt-0.5">{s.asalSekolah}</div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                        s.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                      }`}>
                        {s.jenisKelamin}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">{s.kelasAsal}</span>
                    </td>
                    <td className="p-4 text-center font-mono font-medium text-slate-600">{s.nilaiRataRata}</td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-600" /> Import Data Siswa
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Template Download Card */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">Template Microsoft Excel (.xlsx)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Format kolom terstandarisasi untuk input NISN, NIS, Nama, JK, Kelas, Nilai, dan Asal Sekolah di Excel.
                    </p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <button 
                        type="button"
                        onClick={() => downloadStudentTemplateExcel()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Template (.xlsx)</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => downloadStudentTemplateCsv()}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Unduh CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Mode Import</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setUploadMode('replace')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${uploadMode === 'replace' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Timpa Semua</button>
                  <button onClick={() => setUploadMode('append')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${uploadMode === 'append' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tambahkan</button>
                </div>
              </div>
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-7 text-center hover:bg-slate-50 hover:border-teal-400 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="w-8 h-8 text-teal-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Pilih atau Drag & Drop File</p>
                <p className="text-xs text-slate-400 mt-1">Mendukung file .xlsx, .xls, atau .csv (termasuk ekspor Dapodik)</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700">Kolom yang dikenali: </span>
                NISN, NIS/NIPD, Nama Lengkap, Jenis Kelamin (L/P), Kelas/Rombel (7, 8, 9), Nilai Rata-rata, Asal Sekolah, Keterangan.
              </div>
            </div>
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
