import React, { useState, useEffect, useMemo } from 'react';
import { Room, SchoolMetadata, PdfDocType, ExamScheduleItem } from '../types';
import { generateRoomDocumentsPdf, PdfConfig, DEFAULT_JADWAL_TKA1, DEFAULT_JADWAL_ASAT } from '../utils/pdfGenerator';
import { 
  FileText, Download, Eye, LayoutList, CheckSquare, Users, PenTool, Hash, Printer, Settings,
  CreditCard, Calendar, Clock, BookOpen, Plus, Trash2, ChevronDown, ChevronUp, RotateCcw,
  Filter, GraduationCap, ArrowDownAZ
} from 'lucide-react';
import { PdfViewer } from './PdfViewer';

interface PdfDocumentsTabProps {
  rooms: Room[];
  metadata: SchoolMetadata;
  initialDocType?: PdfDocType;
  initialRoomId?: number;
}

export function PdfDocumentsTab({ rooms, metadata, initialDocType, initialRoomId }: PdfDocumentsTabProps) {
  const [selectedDocType, setSelectedDocType] = useState<PdfDocType>(initialDocType || 'kartu_peserta');
  const [selectedRoomId, setSelectedRoomId] = useState<number | 'all'>(initialRoomId || 'all');
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('F4');
  
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Kartu Peserta & Jadwal State
  const [schedulePreset, setSchedulePreset] = useState<'tka1' | 'asat' | 'custom'>('tka1');
  const [examSchedule, setExamSchedule] = useState<ExamScheduleItem[]>(() => {
    if (metadata.jadwalUjian && metadata.jadwalUjian.length > 0) {
      const hasOldDates = metadata.jadwalUjian.some(j => j.hariTanggal.includes('21 September') || j.hariTanggal.includes('22 September'));
      if (!hasOldDates) return metadata.jadwalUjian;
    }
    return DEFAULT_JADWAL_TKA1;
  });
  const [tanggalCetak, setTanggalCetak] = useState<string>(metadata.tanggalCetakKartu || 'Kemranjen, 19 Agustus 2026');
  const [catatanKartu, setCatatanKartu] = useState<string>(metadata.catatanKartu || '*Selama TKA 1 berlangsung, kartu harus dibawa');
  const [penandatanganKartu, setPenandatanganKartu] = useState<'kepala_sekolah' | 'ketua_pelaksana'>(
    metadata.penandatanganKartu || 'kepala_sekolah'
  );
  const [showScheduleEditor, setShowScheduleEditor] = useState<boolean>(false);

  // Filter Tingkat & Kelas khusus Kartu Peserta
  const [filterTingkat, setFilterTingkat] = useState<'all' | '7' | '8' | '9'>('all');
  const [filterKelas, setFilterKelas] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'ruang' | 'kelas'>('ruang');

  // Daftar kelas unik dari database
  const availableKelas = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      r.seats.forEach(s => {
        if (s.student?.kelasAsal) {
          if (filterTingkat === 'all' || String(s.student.jenjang) === filterTingkat) {
            set.add(s.student.kelasAsal);
          }
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms, filterTingkat]);

  // Hitung jumlah kartu yang aktif terfilter
  const totalFilteredCards = useMemo(() => {
    let count = 0;
    const targetRooms = selectedRoomId === 'all' ? rooms : rooms.filter(r => r.id === selectedRoomId);
    targetRooms.forEach(r => {
      r.seats.forEach(s => {
        if (s.student) {
          if (filterTingkat !== 'all' && String(s.student.jenjang) !== filterTingkat) return;
          if (filterKelas !== 'all' && s.student.kelasAsal !== filterKelas) return;
          count++;
        }
      });
    });
    return count;
  }, [rooms, selectedRoomId, filterTingkat, filterKelas]);

  // Synchronize when metadata prop changes (e.g. from event switch or settings update)
  useEffect(() => {
    if (metadata.jadwalUjian && metadata.jadwalUjian.length > 0) {
      const hasOldDates = metadata.jadwalUjian.some(j => j.hariTanggal.includes('21 September') || j.hariTanggal.includes('22 September'));
      if (hasOldDates) {
        setExamSchedule(DEFAULT_JADWAL_TKA1);
      } else {
        setExamSchedule(metadata.jadwalUjian);
      }
    } else {
      setExamSchedule(DEFAULT_JADWAL_TKA1);
    }
    if (metadata.tanggalCetakKartu) setTanggalCetak(metadata.tanggalCetakKartu);
    if (metadata.catatanKartu) setCatatanKartu(metadata.catatanKartu);
  }, [metadata]);

  const docTypes: { id: PdfDocType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'kartu_peserta', label: 'Kartu Peserta', icon: <CreditCard className="w-5 h-5" />, desc: 'Format resmi 4 kartu/halaman dengan TTD & Stempel' },
    { id: 'denah', label: 'Denah Tempat Duduk', icon: <LayoutList className="w-5 h-5" />, desc: 'Layout visual bangku' },
    { id: 'daftar_hadir', label: 'Daftar Hadir', icon: <PenTool className="w-5 h-5" />, desc: 'Tanda tangan peserta' },
    { id: 'peserta_ruang', label: 'Daftar Peserta', icon: <Users className="w-5 h-5" />, desc: 'Daftar nama per ruang' },
    { id: 'cek_kehadiran', label: 'Cek Kehadiran', icon: <CheckSquare className="w-5 h-5" />, desc: 'Portrait F4 — Literasi & Numerasi' },
    { id: 'label_meja', label: 'Label Meja', icon: <Hash className="w-5 h-5" />, desc: 'Stiker meja 8/hal dengan TTD & Stempel' },
  ];

  useEffect(() => {
    generatePdfPreview();
  }, [selectedDocType, selectedRoomId, rooms, metadata, paperSize, examSchedule, tanggalCetak, catatanKartu, penandatanganKartu, filterTingkat, filterKelas, sortBy]);

  const generatePdfPreview = async () => {
    if (!rooms.length) return;
    
    setIsGenerating(true);
    try {
      const isCardOrLabel = selectedDocType === 'kartu_peserta' || selectedDocType === 'label_meja';
      const config: PdfConfig = {
        rooms: selectedRoomId === 'all' ? rooms : rooms.filter(r => r.id === selectedRoomId),
        metadata: { ...metadata, penandatanganKartu },
        docTypes: [selectedDocType],
        paperSize: paperSize,
        jadwalUjian: examSchedule,
        tanggalCetakKartu: tanggalCetak,
        catatanKartu: catatanKartu,
        filterTingkat: isCardOrLabel ? filterTingkat : undefined,
        filterKelas: isCardOrLabel ? filterKelas : undefined,
        sortBy: isCardOrLabel ? sortBy : undefined
      };
      
      const doc = await generateRoomDocumentsPdf(config);
      const arrayBuffer = doc.output('arraybuffer');
      const uint8Array = new Uint8Array(arrayBuffer);
      setPdfData(uint8Array);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!rooms.length) return;
    const isCardOrLabel = selectedDocType === 'kartu_peserta' || selectedDocType === 'label_meja';
    const config: PdfConfig = {
      rooms: selectedRoomId === 'all' ? rooms : rooms.filter(r => r.id === selectedRoomId),
      metadata: { ...metadata, penandatanganKartu },
      docTypes: [selectedDocType],
      paperSize: paperSize,
      jadwalUjian: examSchedule,
      tanggalCetakKartu: tanggalCetak,
      catatanKartu: catatanKartu,
      filterTingkat: isCardOrLabel ? filterTingkat : undefined,
      filterKelas: isCardOrLabel ? filterKelas : undefined,
      sortBy: isCardOrLabel ? sortBy : undefined
    };
    const doc = await generateRoomDocumentsPdf(config);
    const filterSuffix = isCardOrLabel && filterKelas !== 'all' ? `_kelas_${filterKelas}` : '';
    const fileName = `${selectedDocType}_${selectedRoomId === 'all' ? 'semua_ruang' : `ruang_${selectedRoomId}`}${filterSuffix}.pdf`;
    doc.save(fileName);
  };

  const handlePrintAll = async () => {
    if (!rooms.length) return;
    const config: PdfConfig = {
      rooms: selectedRoomId === 'all' ? rooms : rooms.filter(r => r.id === selectedRoomId),
      metadata: { ...metadata, penandatanganKartu },
      docTypes: ['kartu_peserta', 'denah', 'daftar_hadir', 'peserta_ruang', 'cek_kehadiran', 'label_meja'],
      paperSize: paperSize,
      jadwalUjian: examSchedule,
      tanggalCetakKartu: tanggalCetak,
      catatanKartu: catatanKartu,
      filterTingkat: filterTingkat,
      filterKelas: filterKelas,
      sortBy: sortBy
    };
    const doc = await generateRoomDocumentsPdf(config);
    const fileName = `Semua_Dokumen_${selectedRoomId === 'all' ? 'Semua_Ruang' : `Ruang_${selectedRoomId}`}.pdf`;
    doc.save(fileName);
  };

  const handleSelectPreset = (preset: 'tka1' | 'asat') => {
    setSchedulePreset(preset);
    if (preset === 'tka1') {
      setExamSchedule(DEFAULT_JADWAL_TKA1);
      setTanggalCetak('Kemranjen, 19 Agustus 2026');
      setCatatanKartu('*Selama TKA 1 berlangsung, kartu harus dibawa');
    } else {
      setExamSchedule(DEFAULT_JADWAL_ASAT);
      setTanggalCetak('Kemranjen, 20 Mei 2026');
      setCatatanKartu('*Selama ASAT berlangsung, kartu harus dibawa');
    }
  };

  const handleScheduleChange = (index: number, field: keyof ExamScheduleItem, val: string | number) => {
    setSchedulePreset('custom');
    setExamSchedule(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleAddScheduleRow = () => {
    setSchedulePreset('custom');
    setExamSchedule(prev => [
      ...prev,
      {
        no: prev.length + 1,
        hariTanggal: 'Jumat, 25 September 2026',
        waktu: '07.30 - 09.30',
        mataPelajaran: 'Mata Pelajaran Baru'
      }
    ]);
  };

  const handleRemoveScheduleRow = (index: number) => {
    setSchedulePreset('custom');
    setExamSchedule(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-88 flex flex-col gap-5 shrink-0 overflow-y-auto pr-2 pb-10">
        
        {/* Document Type Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Jenis Dokumen
          </h3>
          <div className="flex flex-col gap-1.5">
            {docTypes.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocType(doc.id)}
                className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  selectedDocType === doc.id
                    ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-500 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  selectedDocType === doc.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {doc.icon}
                </div>
                <div>
                  <div className={`font-semibold text-sm ${selectedDocType === doc.id ? 'text-teal-950' : 'text-slate-800'}`}>
                    {doc.label}
                  </div>
                  <div className="text-xs text-slate-500">{doc.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Paper Size & Room Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-600" />
            Pengaturan Cetak
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ukuran Kertas</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setPaperSize('A4')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    paperSize === 'A4' ? 'bg-white text-teal-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  A4 (210 × 297mm)
                </button>
                <button
                  onClick={() => setPaperSize('F4')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    paperSize === 'F4' ? 'bg-white text-teal-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  F4 (215 × 330mm)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Filter Ruang</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 py-2 px-3 text-slate-800"
              >
                <option value="all">Semua Ruang ({rooms.length} ruang)</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>{room.nama} ({room.seats.filter(s => s.student).length} siswa)</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Specialized Settings for Kartu Peserta & Label Meja */}
        {(selectedDocType === 'kartu_peserta' || selectedDocType === 'label_meja') && (
          <div className="bg-white rounded-2xl shadow-sm border border-teal-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-teal-600" />
                {selectedDocType === 'label_meja' ? 'Filter & Urutan Label Meja' : 'Filter & Urutan Kartu'}
              </h3>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                {totalFilteredCards} {selectedDocType === 'label_meja' ? 'Label' : 'Kartu'} ({Math.ceil(totalFilteredCards / (selectedDocType === 'label_meja' ? 8 : 4))} Hal)
              </span>
            </div>

            {selectedDocType === 'label_meja' && (
              <div className="text-[11px] text-teal-800 bg-teal-50/70 border border-teal-200 rounded-lg p-2.5 flex items-start gap-2">
                <CheckSquare className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-teal-900">Scan TTD Kepala Sekolah & Stempel</div>
                  <div className="text-slate-600 text-[10.5px]">Setiap label meja memuat scan tanda tangan Kepala Sekolah dan stempel resmi secara otomatis. Gunakan filter tingkat atau kelas di atas agar stiker meja dicetak terpisah dan tidak bercampur.</div>
                </div>
              </div>
            )}

            {/* Filter Tingkat */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                Filter Tingkat / Jenjang
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: '7', label: 'Kls 7' },
                  { id: '8', label: 'Kls 8' },
                  { id: '9', label: 'Kls 9' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setFilterTingkat(t.id as any);
                      setFilterKelas('all'); // reset kelas saat tingkat berganti
                    }}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      filterTingkat === t.id
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Kelas Rombel */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Filter Kelas / Rombel
              </label>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 py-2 px-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="all">Semua Kelas ({availableKelas.length} kelas)</option>
                {availableKelas.map(k => (
                  <option key={k} value={k}>Kelas {k}</option>
                ))}
              </select>
            </div>

            {/* Urutan Susunan Kartu */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <ArrowDownAZ className="w-3.5 h-3.5 text-teal-600" />
                Urutan dalam Halaman
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSortBy('ruang')}
                  className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all text-center ${
                    sortBy === 'ruang'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Per Ruang & Meja
                </button>
                <button
                  onClick={() => setSortBy('kelas')}
                  className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all text-center ${
                    sortBy === 'kelas'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Per Kelas & Nama
                </button>
              </div>
            </div>

            {selectedDocType === 'kartu_peserta' && (
              <>
                <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    Format Jadwal & TTD
                  </h4>
                  <button
                    onClick={() => setShowScheduleEditor(!showScheduleEditor)}
                    className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    {showScheduleEditor ? 'Sembunyikan' : 'Edit Jadwal'}
                    {showScheduleEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

              {/* Presets */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Preset Jadwal</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleSelectPreset('tka1')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                      schedulePreset === 'tka1'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TKA 1 (2 Mapel)
                  </button>
                  <button
                    onClick={() => handleSelectPreset('asat')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                      schedulePreset === 'asat'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ASAT (12 Mapel)
                  </button>
                </div>
              </div>

              {/* Tanggal Cetak & Catatan */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Tempat & Tanggal Cetak</label>
                  <input
                    type="text"
                    value={tanggalCetak}
                    onChange={(e) => setTanggalCetak(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Misal: Kemranjen, 19 Agustus 2026"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Catatan Bawah Kartu</label>
                  <input
                    type="text"
                    value={catatanKartu}
                    onChange={(e) => setCatatanKartu(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="*Selama ujian berlangsung, kartu harus dibawa"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Penandatangan Kartu</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPenandatanganKartu('kepala_sekolah')}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all text-center ${
                        penandatanganKartu === 'kepala_sekolah'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Kepala Sekolah
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenandatanganKartu('ketua_pelaksana')}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all text-center ${
                        penandatanganKartu === 'ketua_pelaksana'
                          ? 'bg-white text-teal-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ketua Pelaksana
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable Schedule Editor */}
            {showScheduleEditor && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Daftar Sesi Ujian ({examSchedule.length})</span>
                  <button
                    onClick={handleAddScheduleRow}
                    className="text-xs text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Sesi
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {examSchedule.map((row, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Sesi {idx + 1} (No: {row.no})</span>
                        <button
                          onClick={() => handleRemoveScheduleRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-0.5"
                          title="Hapus sesi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-slate-500">Hari, Tanggal</label>
                          <input
                            type="text"
                            value={row.hariTanggal}
                            onChange={(e) => handleScheduleChange(idx, 'hariTanggal', e.target.value)}
                            className="w-full text-[11px] p-1 border rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Waktu</label>
                          <input
                            type="text"
                            value={row.waktu}
                            onChange={(e) => handleScheduleChange(idx, 'waktu', e.target.value)}
                            className="w-full text-[11px] p-1 border rounded bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Mata Pelajaran</label>
                        <input
                          type="text"
                          value={row.mataPelajaran}
                          onChange={(e) => handleScheduleChange(idx, 'mataPelajaran', e.target.value)}
                          className="w-full text-[11px] p-1 border rounded bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-xl font-semibold shadow-sm transition-all active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            Download {docTypes.find(d => d.id === selectedDocType)?.label}
          </button>
          
          <button
            onClick={handlePrintAll}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.99]"
          >
            <Printer className="w-4 h-4" />
            Download Semua Dokumen
          </button>
        </div>
      </div>

      {/* PDF Preview Frame */}
      <div className="flex-1 bg-slate-200 rounded-2xl overflow-hidden border border-slate-300 flex flex-col relative min-h-[500px]">
        {isGenerating ? (
          <div className="absolute inset-0 bg-slate-100/80 backdrop-blur-xs flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 font-medium">Menghasilkan Dokumen PDF...</p>
          </div>
        ) : null}
        
        <div className="bg-slate-800 text-slate-300 px-4 py-2 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-teal-400" />
            <span>
              Preview: <strong className="text-white">{docTypes.find(d => d.id === selectedDocType)?.label}</strong>
              {' '}({selectedRoomId === 'all' ? 'Semua Ruang' : `Ruang ${selectedRoomId}`}) — {paperSize}
            </span>
          </div>
          {selectedDocType === 'kartu_peserta' && (
            <span className="text-[11px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
              4 Kartu per Halaman (Identitas & Jadwal)
            </span>
          )}
          {selectedDocType === 'label_meja' && (
            <span className="text-[11px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
              8 Label per Halaman (dengan TTD & Stempel)
            </span>
          )}
          {selectedDocType === 'cek_kehadiran' && (
            <span className="text-[11px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
              Portrait F4 — 2 Mapel (Literasi & Numerasi)
            </span>
          )}
        </div>
        
        {pdfData ? (
          <div className="flex-1 w-full relative h-full min-h-0 overflow-hidden">
            <PdfViewer data={pdfData} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Preview tidak tersedia
          </div>
        )}
      </div>
    </div>
  );
}
