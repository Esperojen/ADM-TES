import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  Database, 
  Users, 
  Building2, 
  Stamp, 
  PenTool, 
  RefreshCw,
  HardDriveDownload,
  HardDriveUpload,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  downloadBackup, 
  validateBackupFile, 
  restoreBackupData, 
  BackupMetadata, 
  ValidationResult 
} from '../utils/backupRestoreManager';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEventId?: number;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  activeEventId
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<BackupMetadata | null>(null);

  // Restore states
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live counts for active database
  const academicYears = useLiveQuery(() => db.academicYears.toArray());
  const assessmentEvents = useLiveQuery(() => db.assessmentEvents.toArray());
  const students = useLiveQuery(() => db.students.toArray());
  const rooms = useLiveQuery(() => db.rooms.toArray());
  const settings = useLiveQuery(() => db.appSettings.toArray());

  const activeEvent = assessmentEvents?.find(e => e.id === activeEventId) || assessmentEvents?.[0];
  const schoolName = activeEvent?.metadata?.namaSekolah || 'Sekolah';
  const academicYear = activeEvent?.metadata?.tahunAjaran || '2026/2027';

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    try {
      setIsExporting(true);
      const meta = await downloadBackup(activeEventId);
      setExportSuccessInfo(meta);
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengekspor data: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileProcess = async (file: File) => {
    setAnalyzingFile(true);
    setValidationResult(null);
    setRestoreSuccess(false);
    try {
      const result = await validateBackupFile(file);
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({
        valid: false,
        error: 'Gagal memproses file: ' + err.message
      });
    } finally {
      setAnalyzingFile(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleExecuteRestore = async () => {
    if (!validationResult || !validationResult.valid || !validationResult.payload) return;

    const confirmAction = window.confirm(
      `PERINGATAN: Memulihkan cadangan akan menggantikan data aktif saat ini dengan data dari berkas cadangan:\n` +
      `• Asal Sekolah: ${validationResult.metadata?.schoolName || 'Tidak Diketahui'}\n` +
      `• Total Siswa: ${validationResult.metadata?.stats.studentsCount || 0} Siswa\n` +
      `• Total Ruangan: ${validationResult.metadata?.stats.roomsCount || 0} Ruang\n\n` +
      `Lanjutkan proses pemulihan data?`
    );

    if (!confirmAction) return;

    try {
      setIsRestoring(true);
      await restoreBackupData(validationResult.payload);
      setRestoreSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      alert('Gagal memulihkan data: ' + (err.message || 'Kesalahan pada database.'));
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-wide">Pencadangan & Pemulihan Data</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Aman & Terenkapsulasi
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Amankan database ujian offline Anda ke berkas .JSON atau pulihkan kapan pun dibutuhkan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3">
          <button
            onClick={() => { setActiveTab('backup'); setExportSuccessInfo(null); }}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDriveDownload className="w-4 h-4" />
            Cadangkan Data Aktif (Backup)
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDriveUpload className="w-4 h-4" />
            Pulihkan Data (Restore)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* TAB 1: CADANGKAN DATA */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              
              {/* Active Data Overview Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">Status Data Lokal Saat Ini</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {schoolName} • TP {academicYear}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Siswa Terdaftar</span>
                    <strong className="text-sm text-slate-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      {students?.length || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Ruang Terdistribusi</span>
                    <strong className="text-sm text-slate-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      {rooms?.length || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Acara Asesmen</span>
                    <strong className="text-sm text-slate-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      {assessmentEvents?.length || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Asset TTD & Stempel</span>
                    <strong className="text-sm text-slate-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <Stamp className="w-3.5 h-3.5 text-teal-600" />
                      {settings?.filter(s => s.key.startsWith('ttd') || s.key.startsWith('stempel') || s.key.startsWith('logo')).length || 0} Item
                    </strong>
                  </div>
                </div>
              </div>

              {/* Guarantees & Features */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Format Cadangan Aman V2 (JSON Integrity Envelope)
                </div>
                <ul className="text-[11px] text-emerald-800 space-y-1 list-disc pl-4">
                  <li>Menyimpan seluruh data murid, denah ruang, dan penempatan nomor kursi secara akurat.</li>
                  <li>Mencakup seluruh file scan tanda tangan Kepala Sekolah/Ketua dan stempel resmi transparan.</li>
                  <li>Dapat dipindahkan dan dibuka di laptop atau komputer pengawas lainnya tanpa koneksi internet.</li>
                </ul>
              </div>

              {/* Success Info Banner */}
              {exportSuccessInfo && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-900 flex items-start gap-2.5 animate-in fade-in duration-150">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Cadangan Berhasil Diunduh!</span>
                    <span className="text-[11px] text-teal-700">
                      File cadangan telah tersimpan di folder Download perangkat Anda. Simpan file ini di tempat yang aman.
                    </span>
                  </div>
                </div>
              )}

              {/* Download Action Button */}
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.99] cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Membuat Cadangan Proyek...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Unduh Cadangan Proyek (.json)
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: PULIHKAN DATA */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              
              {/* Dropzone Upload Area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/50'
                    : 'border-slate-300 hover:border-teal-500 bg-slate-50/60 hover:bg-teal-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mb-2.5">
                  <FileJson className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-800 mb-1">
                  Klik untuk Memilih File Cadangan atau Tarik ke Sini
                </div>
                <p className="text-[11px] text-slate-500">
                  Mendukung format berkas cadangan resmi <strong>.JSON</strong> dari aplikasi ini
                </p>
              </div>

              {/* Analyzing State */}
              {analyzingFile && (
                <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  Menganalisis integritas data berkas cadangan...
                </div>
              )}

              {/* File Inspection / Preview Result */}
              {validationResult && (
                <div className="space-y-3">
                  {validationResult.valid ? (
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-950">Berkas Cadangan Valid & Terverifikasi</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          {validationResult.metadata?.version || 'v2.0'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Nama Sekolah:</span>
                          <strong className="text-slate-800 font-bold truncate block">
                            {validationResult.metadata?.schoolName || '-'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Waktu Pencadangan:</span>
                          <span className="text-slate-700 font-medium">
                            {validationResult.metadata?.exportedAt 
                              ? new Date(validationResult.metadata.exportedAt).toLocaleString('id-ID')
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Content stats */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-100 text-[11px]">
                        <div className="bg-white p-2 rounded border border-emerald-100">
                          <span className="text-slate-400 block text-[9.5px]">Total Siswa</span>
                          <span className="font-bold text-slate-800">{validationResult.metadata?.stats.studentsCount || 0} Siswa</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-emerald-100">
                          <span className="text-slate-400 block text-[9.5px]">Total Ruang</span>
                          <span className="font-bold text-slate-800">{validationResult.metadata?.stats.roomsCount || 0} Ruang</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-emerald-100">
                          <span className="text-slate-400 block text-[9.5px]">Scan TTD & Stempel</span>
                          <span className="font-bold text-slate-800">
                            {validationResult.metadata?.stats.hasSignatures || validationResult.metadata?.stats.hasStamp ? 'Tersedia' : 'Tidak ada'}
                          </span>
                        </div>
                      </div>

                      {/* Warning */}
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Perhatian:</strong> Memulihkan cadangan akan menimpa database lokal saat ini. Pastikan Anda telah mencadangkan data terkini jika masih diperlukan.
                        </span>
                      </div>

                      {/* Restore Action */}
                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        disabled={isRestoring}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.99] cursor-pointer"
                      >
                        {isRestoring ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Memulihkan Seluruh Database...
                          </>
                        ) : (
                          <>
                            <HardDriveUpload className="w-4 h-4" />
                            Pulihkan Data Sekarang
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Error state */
                    <div className="border border-rose-200 bg-rose-50 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-rose-900 block">Berkas Tidak Valid</span>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          {validationResult.error || 'Struktur berkas tidak sesuai format cadangan sistem.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Restore Success Screen */}
              {restoreSuccess && (
                <div className="bg-emerald-600 text-white p-4 rounded-xl text-center space-y-1.5 animate-in zoom-in-95 duration-150">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-200" />
                  <span className="font-bold text-sm block">Data Berhasil Dipulihkan!</span>
                  <p className="text-xs text-emerald-100">
                    Memuat ulang aplikasi untuk menerapkan seluruh data yang dipulihkan...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Penyimpanan offline berbasis IndexedDB browser</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
