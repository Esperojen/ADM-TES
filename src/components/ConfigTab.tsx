import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, Building2, UserCircle2, FileText, CalendarDays, Upload, Trash2, CheckCircle2, PenLine, Stamp, Sparkles, Wand2, Download, HardDrive, FileJson, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DistributionConfig, SchoolMetadata, Student, Room } from '../types';
import { db } from '../db/db';
import { DateRangePicker } from './DateRangePicker';
import { DEFAULT_JADWAL_TKA1 } from '../utils/pdfGenerator';
import { removeWhiteBackground } from '../utils/imageProcessing';
import { BackupRestoreModal } from './BackupRestoreModal';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import { downloadBackup } from '../utils/backupRestoreManager';

interface ConfigTabProps {
  config: DistributionConfig;
  metadata: SchoolMetadata;
  students: Student[];
  onUpdateConfig: (newConfig: DistributionConfig) => void;
  onUpdateMetadata: (newMetadata: SchoolMetadata) => void;
  onReapplyDistribution: () => void;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  config,
  metadata,
  students,
  onUpdateConfig,
  onUpdateMetadata,
  onReapplyDistribution
}) => {
  const [localConfig, setLocalConfig] = useState<DistributionConfig>(config);
  
  const [localMeta, setLocalMeta] = useState<SchoolMetadata>(() => {
    const meta = { ...metadata };
    if (meta.tanggalUjian?.includes('21 - 22 September') || meta.tanggalUjian?.includes('21 September')) {
      meta.tanggalUjian = '23 - 24 September 2026';
    }
    if (meta.jadwalUjian?.some(j => j.hariTanggal.includes('21 September') || j.hariTanggal.includes('22 September'))) {
      meta.jadwalUjian = DEFAULT_JADWAL_TKA1;
    }
    return meta;
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const roomsRecords = useLiveQuery(() => db.rooms.toArray());
  const rooms: Room[] = roomsRecords?.map(r => r.roomData) || [];

  // Helper to parse date from string like "23 - 24 September 2026"
  const parseDatesFromText = (str?: string) => {
    if (!str) return { start: null, end: null };
    const rangeMatch = str.match(/(\d+)\s*-\s*(\d+)\s+([A-Za-z]+)\s+(\d{4})/);
    if (rangeMatch) {
      const d1 = parseInt(rangeMatch[1]);
      const d2 = parseInt(rangeMatch[2]);
      const mStr = rangeMatch[3].toLowerCase();
      const y = parseInt(rangeMatch[4]);
      const mNames = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
      const mIdx = mNames.indexOf(mStr);
      if (mIdx !== -1) {
        return { start: new Date(y, mIdx, d1), end: new Date(y, mIdx, d2) };
      }
    }
    return { start: null, end: null };
  };

  const initialDates = parseDatesFromText(localMeta.tanggalUjian);
  const [startD, setStartD] = useState<Date | null>(initialDates.start);
  const [endD, setEndD] = useState<Date | null>(initialDates.end);

  const logoKiriSetting = useLiveQuery(() => db.appSettings.get('logoKiri'));
  const logoKananSetting = useLiveQuery(() => db.appSettings.get('logoKanan'));
  const ttdKepalaSekolahSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const ttdKetuaPelaksanaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));
  const stempelSekolahSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  useEffect(() => {
    if (startD && endD) {
      const m1 = startD.toLocaleDateString('id-ID', { month: 'long' });
      const m2 = endD.toLocaleDateString('id-ID', { month: 'long' });
      const y1 = startD.getFullYear();
      const y2 = endD.getFullYear();
      let formatted = '';
      if (m1 === m2 && y1 === y2) {
        formatted = `${startD.getDate()} - ${endD.getDate()} ${m1} ${y1}`;
      } else if (y1 === y2) {
        formatted = `${startD.getDate()} ${m1} - ${endD.getDate()} ${m2} ${y1}`;
      } else {
        formatted = `${startD.getDate()} ${m1} ${y1} - ${endD.getDate()} ${m2} ${y2}`;
      }
      setLocalMeta(prev => ({ ...prev, tanggalUjian: formatted }));
    } else if (startD) {
      setLocalMeta(prev => ({ ...prev, tanggalUjian: startD.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }));
    }
  }, [startD, endD]);

  const totalStudents = students.length;
  const recommendedRooms = Math.ceil(totalStudents / localConfig.kapasitasPerRuang);

  const [isProcessing, setIsProcessing] = useState<{ [key: string]: boolean }>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logoKiri' | 'logoKanan' | 'ttdKepalaSekolah' | 'ttdKetuaPelaksana' | 'stempelSekolah') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      let base64 = event.target?.result as string;
      const isSignatureOrStamp = key === 'ttdKepalaSekolah' || key === 'ttdKetuaPelaksana' || key === 'stempelSekolah';
      
      if (isSignatureOrStamp) {
        setIsProcessing(prev => ({ ...prev, [key]: true }));
        try {
          // Otomatis bersihkan background putih menjadi transparan
          base64 = await removeWhiteBackground(base64);
        } catch (err) {
          console.warn('Gagal otomatis membersihkan background:', err);
        } finally {
          setIsProcessing(prev => ({ ...prev, [key]: false }));
        }
      }

      await db.appSettings.put({ key, value: base64 });
      const labelMap = {
        logoKiri: 'Logo Kiri',
        logoKanan: 'Logo Kanan',
        ttdKepalaSekolah: 'Scan Tanda Tangan Kepala Sekolah',
        ttdKetuaPelaksana: 'Scan Tanda Tangan Ketua Pelaksana',
        stempelSekolah: 'Scan Stempel Sekolah'
      };
      alert(`${labelMap[key]} berhasil disimpan${isSignatureOrStamp ? ' dan background putih berhasil diubah menjadi transparan!' : '!'}`);
    };
    reader.readAsDataURL(file);
  };

  const handleMakeTransparent = async (key: 'ttdKepalaSekolah' | 'ttdKetuaPelaksana' | 'stempelSekolah', threshold: number = 215) => {
    const setting = await db.appSettings.get(key);
    if (!setting?.value) return;
    setIsProcessing(prev => ({ ...prev, [key]: true }));
    try {
      const transparentBase64 = await removeWhiteBackground(setting.value, { threshold, tolerance: 35 });
      await db.appSettings.put({ key, value: transparentBase64 });
      const label = key === 'ttdKepalaSekolah' ? 'TTD Kepala Sekolah' : key === 'ttdKetuaPelaksana' ? 'TTD Ketua Pelaksana' : 'Stempel';
      alert(`Berhasil! Background ${label} telah diubah menjadi transparan.`);
    } catch (e) {
      alert('Gagal memproses transparansi gambar.');
    } finally {
      setIsProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  // Export full project JSON
  const handleExportBackup = async () => {
    try {
      const academicYears = await db.academicYears.toArray();
      const assessmentEvents = await db.assessmentEvents.toArray();
      const studentsData = await db.students.toArray();
      const roomsData = await db.rooms.toArray();
      const settings = await db.appSettings.toArray();

      const backupData = {
        app: 'Sistem Administrasi Ruang & Denah Ujian',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          academicYears,
          assessmentEvents,
          students: studentsData,
          rooms: roomsData,
          appSettings: settings,
          currentConfig: localConfig,
          currentMetadata: localMeta
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `Backup-Proyek-Ujian-${(localMeta.namaSekolah || 'Sekolah').replace(/[^a-zA-Z0-9]/g, '_')}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor cadangan proyek.');
    }
  };

  // Import full project JSON
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'Apakah Anda yakin ingin memulihkan cadangan ini? Data saat ini akan digantikan dengan data dari file cadangan.'
    );
    if (!confirmRestore) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.data) {
        throw new Error('Format file cadangan tidak valid.');
      }

      await db.transaction('rw', [db.academicYears, db.assessmentEvents, db.students, db.rooms, db.appSettings], async () => {
        if (parsed.data.academicYears) {
          await db.academicYears.clear();
          await db.academicYears.bulkAdd(parsed.data.academicYears);
        }
        if (parsed.data.assessmentEvents) {
          await db.assessmentEvents.clear();
          await db.assessmentEvents.bulkAdd(parsed.data.assessmentEvents);
        }
        if (parsed.data.students) {
          await db.students.clear();
          await db.students.bulkAdd(parsed.data.students);
        }
        if (parsed.data.rooms) {
          await db.rooms.clear();
          await db.rooms.bulkAdd(parsed.data.rooms);
        }
        if (parsed.data.appSettings) {
          await db.appSettings.clear();
          await db.appSettings.bulkAdd(parsed.data.appSettings);
        }
      });

      if (parsed.data.currentConfig) {
        setLocalConfig(parsed.data.currentConfig);
        onUpdateConfig(parsed.data.currentConfig);
      }
      if (parsed.data.currentMetadata) {
        setLocalMeta(parsed.data.currentMetadata);
        onUpdateMetadata(parsed.data.currentMetadata);
      }

      alert('Cadangan proyek berhasil dipulihkan!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Gagal memulihkan cadangan: Format file tidak sesuai.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveSetting = async (key: 'logoKiri' | 'logoKanan' | 'ttdKepalaSekolah' | 'ttdKetuaPelaksana' | 'stempelSekolah') => {
    await db.appSettings.delete(key);
  };

  const handleSave = () => {
    onUpdateConfig(localConfig);
    onUpdateMetadata(localMeta);
    onReapplyDistribution();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        
        {/* Aturan Distribusi */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Aturan Distribusi Ruang</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Kapasitas per Ruang</label>
              <input
                type="number"
                min={1}
                max={40}
                value={localConfig.kapasitasPerRuang}
                onChange={(e) => setLocalConfig({...localConfig, kapasitasPerRuang: Number(e.target.value)})}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Maks: 32 meja.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Jumlah Ruang (Manual)</label>
              <input
                type="number"
                min={1}
                value={localConfig.jumlahRuang || ''}
                onChange={(e) => setLocalConfig({...localConfig, jumlahRuang: e.target.value ? Number(e.target.value) : 0})}
                placeholder={`Otomatis (${recommendedRooms})`}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Kosongkan untuk otomatis.</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-amber-800">Distribusi Ulang</p>
                <p className="text-xs text-amber-700">Menyimpan akan mereset formasi bangku.</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isSaved ? 'bg-green-500 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaved ? 'Tersimpan & Terapkan' : 'Simpan & Distribusi'}
            </button>
          </div>
        </div>

        {/* Informasi Sekolah */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Kop & Metadata Sekolah</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Nama Sekolah</label>
              <input value={localMeta.namaSekolah} onChange={e => setLocalMeta({...localMeta, namaSekolah: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Baris 1 & 2 Kop</label>
              <textarea value={localMeta.kabupaten} onChange={e => setLocalMeta({...localMeta, kabupaten: e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Alamat Lengkap</label>
              <input value={localMeta.alamat} onChange={e => setLocalMeta({...localMeta, alamat: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Logo Kiri (Opsional)</label>
              <div className="flex items-center gap-4">
                {logoKiriSetting?.value && (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center relative group">
                    <img src={logoKiriSetting.value} alt="Logo Kiri" className="max-w-full max-h-full object-contain" />
                    <button
                      onClick={() => handleRemoveSetting('logoKiri')}
                      className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Hapus Logo Kiri"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <label className="flex flex-1 items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50 transition-colors text-slate-600">
                  <Upload className="w-4 h-4" />
                  <span>Unggah Gambar Kiri</span>
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'logoKiri')} />
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Logo Kanan (Opsional)</label>
              <div className="flex items-center gap-4">
                {logoKananSetting?.value && (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center relative group">
                    <img src={logoKananSetting.value} alt="Logo Kanan" className="max-w-full max-h-full object-contain" />
                    <button
                      onClick={() => handleRemoveSetting('logoKanan')}
                      className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Hapus Logo Kanan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <label className="flex flex-1 items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50 transition-colors text-slate-600">
                  <Upload className="w-4 h-4" />
                  <span>Unggah Gambar Kanan</span>
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'logoKanan')} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scan Tanda Tangan & Stempel Resmi */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Scan Tanda Tangan & Stempel Resmi</h3>
              <p className="text-xs text-slate-500">Otomatis dicetak pada Kartu Peserta dan seluruh dokumen ujian</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
            {/* Tanda Tangan Kepala Sekolah */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <PenLine className="w-3.5 h-3.5 text-indigo-600" />
                    Scan TTD Kepala Sekolah
                  </span>
                  {ttdKepalaSekolahSetting?.value ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Terpasang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Belum diunggah</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-2.5">
                  {ttdKepalaSekolahSetting?.value && (
                    <div
                      className="w-20 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 relative group overflow-hidden shadow-2xs shrink-0"
                      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '6px 6px' }}
                      title="Pratinjau Tanda Tangan (Background Transparan)"
                    >
                      <img src={ttdKepalaSekolahSetting.value} alt="TTD Kepala Sekolah" className="max-h-full max-w-full object-contain" />
                      <button
                        onClick={() => handleRemoveSetting('ttdKepalaSekolah')}
                        className="absolute inset-0 bg-rose-600/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus Scan TTD"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-indigo-300 rounded-lg text-xs font-semibold cursor-pointer bg-white hover:bg-indigo-50/50 text-indigo-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>{ttdKepalaSekolahSetting?.value ? 'Ganti Scan TTD' : 'Upload Scan TTD'}</span>
                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'ttdKepalaSekolah')} />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                {ttdKepalaSekolahSetting?.value && (
                  <button
                    type="button"
                    onClick={() => handleMakeTransparent('ttdKepalaSekolah')}
                    disabled={isProcessing['ttdKepalaSekolah']}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Hilangkan latar putih dari kertas scan agar tanda tangan menjadi transparan"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    <span>{isProcessing['ttdKepalaSekolah'] ? 'Memproses Transparansi...' : 'Hapus Background Putih'}</span>
                  </button>
                )}
                <p className="text-[10px] text-slate-500">Otomatis transparan saat diunggah atau klik tombol pembersih.</p>
              </div>
            </div>

            {/* Tanda Tangan Ketua Pelaksana */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <PenLine className="w-3.5 h-3.5 text-teal-600" />
                    Scan TTD Ketua Pelaksana
                  </span>
                  {ttdKetuaPelaksanaSetting?.value ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Terpasang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Belum diunggah</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-2.5">
                  {ttdKetuaPelaksanaSetting?.value && (
                    <div
                      className="w-20 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 relative group overflow-hidden shadow-2xs shrink-0"
                      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '6px 6px' }}
                      title="Pratinjau Tanda Tangan (Background Transparan)"
                    >
                      <img src={ttdKetuaPelaksanaSetting.value} alt="TTD Ketua Pelaksana" className="max-h-full max-w-full object-contain" />
                      <button
                        onClick={() => handleRemoveSetting('ttdKetuaPelaksana')}
                        className="absolute inset-0 bg-rose-600/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus Scan TTD"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-teal-300 rounded-lg text-xs font-semibold cursor-pointer bg-white hover:bg-teal-50/50 text-teal-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>{ttdKetuaPelaksanaSetting?.value ? 'Ganti Scan TTD' : 'Upload Scan TTD'}</span>
                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'ttdKetuaPelaksana')} />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                {ttdKetuaPelaksanaSetting?.value && (
                  <button
                    type="button"
                    onClick={() => handleMakeTransparent('ttdKetuaPelaksana')}
                    disabled={isProcessing['ttdKetuaPelaksana']}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Hilangkan latar putih dari kertas scan agar tanda tangan menjadi transparan"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    <span>{isProcessing['ttdKetuaPelaksana'] ? 'Memproses Transparansi...' : 'Hapus Background Putih'}</span>
                  </button>
                )}
                <p className="text-[10px] text-slate-500">Dicetak pada Denah Ruang & Daftar Peserta Ruang.</p>
              </div>
            </div>

            {/* Stempel Resmi Sekolah */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-blue-600" />
                    Scan Stempel Sekolah
                  </span>
                  {stempelSekolahSetting?.value ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Terpasang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Belum diunggah</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-2.5">
                  {stempelSekolahSetting?.value && (
                    <div
                      className="w-20 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 relative group overflow-hidden shadow-2xs shrink-0"
                      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '6px 6px' }}
                      title="Pratinjau Stempel (Background Transparan)"
                    >
                      <img src={stempelSekolahSetting.value} alt="Stempel Sekolah" className="max-h-full max-w-full object-contain" />
                      <button
                        onClick={() => handleRemoveSetting('stempelSekolah')}
                        className="absolute inset-0 bg-rose-600/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus Scan Stempel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-blue-300 rounded-lg text-xs font-semibold cursor-pointer bg-white hover:bg-blue-50/50 text-blue-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>{stempelSekolahSetting?.value ? 'Ganti Stempel' : 'Upload Stempel'}</span>
                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileUpload(e, 'stempelSekolah')} />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                {stempelSekolahSetting?.value && (
                  <button
                    type="button"
                    onClick={() => handleMakeTransparent('stempelSekolah')}
                    disabled={isProcessing['stempelSekolah']}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Hilangkan latar putih dari kertas scan agar stempel menjadi transparan"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>{isProcessing['stempelSekolah'] ? 'Memproses Transparansi...' : 'Hapus Background Putih'}</span>
                  </button>
                )}
                <p className="text-[10px] text-slate-500">Stempel transparan didekatkan & menimpa tanda tangan kepala sekolah.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        
        {/* Identitas Ujian */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Identitas Ujian</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Nama Kegiatan</label>
              <input value={localMeta.namaUjian} onChange={e => setLocalMeta({...localMeta, namaUjian: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Singkatan</label>
              <input value={localMeta.singkatanUjian} onChange={e => setLocalMeta({...localMeta, singkatanUjian: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Tahun Ajaran</label>
              <input value={localMeta.tahunAjaran} onChange={e => setLocalMeta({...localMeta, tahunAjaran: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Semester</label>
              <select value={localMeta.semester} onChange={e => setLocalMeta({...localMeta, semester: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Tanggal Pelaksanaan</label>
              <DateRangePicker 
                startDate={startD} 
                endDate={endD} 
                onChange={(s, e) => { setStartD(s); setEndD(e); }} 
              />
              <p className="text-[10px] text-slate-500 mt-1">Cetak PDF: {localMeta.tanggalUjian}</p>
            </div>
          </div>
        </div>

        {/* Panitia / TTD */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <UserCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Data Panitia & Penandatangan</h3>
                <p className="text-xs text-slate-500">Data ini akan otomatis disinkronkan ke seluruh dokumen cetak dan denah</p>
              </div>
            </div>
            <button
              onClick={() => {
                onUpdateMetadata(localMeta);
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2500);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Data</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Nama Kepala Sekolah</label>
                <input 
                  value={localMeta.namaKepalaSekolah} 
                  onChange={e => {
                    const updated = { ...localMeta, namaKepalaSekolah: e.target.value };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }} 
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">NIP Kepala Sekolah</label>
                <input 
                  value={localMeta.nipKepalaSekolah} 
                  onChange={e => {
                    const updated = { ...localMeta, nipKepalaSekolah: e.target.value };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }} 
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Nama Ketua Panitia / Pelaksana</label>
                <input 
                  value={localMeta.namaKetuaPelaksana || localMeta.namaKetuaPanitia} 
                  onChange={e => {
                    const updated = { 
                      ...localMeta, 
                      namaKetuaPanitia: e.target.value,
                      namaKetuaPelaksana: e.target.value 
                    };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }} 
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">NIP Ketua Panitia / Pelaksana</label>
                <input 
                  value={localMeta.nipKetuaPelaksana || localMeta.nipKetuaPanitia} 
                  onChange={e => {
                    const updated = { 
                      ...localMeta, 
                      nipKetuaPanitia: e.target.value,
                      nipKetuaPelaksana: e.target.value 
                    };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }} 
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Pejabat Penandatangan Kartu Peserta</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...localMeta, penandatanganKartu: 'kepala_sekolah' as const };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    (localMeta.penandatanganKartu || 'kepala_sekolah') === 'kepala_sekolah'
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-semibold shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">Kepala Sekolah</div>
                    <div className="text-[10px] text-slate-500">Menggunakan Scan TTD Kepala Sekolah & Stempel</div>
                  </div>
                  {(localMeta.penandatanganKartu || 'kepala_sekolah') === 'kepala_sekolah' && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...localMeta, penandatanganKartu: 'ketua_pelaksana' as const };
                    setLocalMeta(updated);
                    onUpdateMetadata(updated);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    localMeta.penandatanganKartu === 'ketua_pelaksana'
                      ? 'border-teal-600 bg-teal-50/60 text-teal-950 font-semibold shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">Ketua Pelaksana Ujian</div>
                    <div className="text-[10px] text-slate-500">Menggunakan Scan TTD Ketua Pelaksana & Stempel</div>
                  </div>
                  {localMeta.penandatanganKartu === 'ketua_pelaksana' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pencadangan & Ekspor Proyek (JSON Backup & Restore) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Pusat Pencadangan & Pemulihan Database</h3>
                <p className="text-xs text-slate-500">
                  Cadangkan seluruh database ujian (siswa, denah ruang, pengaturan, scan tanda tangan & stempel) ke format JSON terenkapsulasi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Buka Dialog Cadangan & Pulihkan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ekspor Cadangan */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileJson className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-800">Unduh Cadangan Lengkap (.json)</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Simpan cadangan offline lengkap dengan ringkasan integritas data untuk arsip atau transfer ke komputer lain.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await downloadBackup();
                    alert('Cadangan proyek berhasil diunduh ke perangkat Anda!');
                  } catch (e: any) {
                    alert('Gagal mengunduh cadangan: ' + e.message);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
              >
                <Download className="w-4 h-4" />
                Unduh Cadangan Proyek (.json)
              </button>
            </div>

            {/* Impor Cadangan */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Pratinjau & Pulihkan Cadangan</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Pilih berkas cadangan JSON dengan validasi keamanan otomatis sebelum menimpa database aktif.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
              >
                <Upload className="w-4 h-4" />
                Pilih Berkas & Pulihkan Data
              </button>
            </div>
          </div>
        </div>

        {/* Sinkronisasi Cloud Google Sheets (Real-Time) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Sinkronisasi Cloud Google Sheets (Real-Time)</h3>
                <p className="text-xs text-slate-500">
                  Sinkronkan daftar siswa, denah meja 1-16 per ruang, dan rekap daftar hadir langsung ke Google Spreadsheet di Google Drive
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGoogleSheetsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Buka Sinkronisasi Google Sheets</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-800 block">
                Akses Data Dari Perangkat Manapun (Smartphone, Tablet, Laptop)
              </span>
              <p className="text-[11px] text-slate-500">
                Data yang disinkronkan akan memiliki 4 tab lembar kerja: Ringkasan & Jadwal, Data Semua Peserta, Denah Per Ruang, dan Rekap Kehadiran Pengawas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGoogleSheetsModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Kelola Sambungan Cloud
            </button>
          </div>
        </div>
      </div>

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        metadata={localMeta}
        students={students}
        rooms={rooms}
      />
    </div>
  );
};
