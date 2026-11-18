import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Plus, Folder, LogIn, Edit, Trash2, AlertTriangle, X, ShieldCheck, Building2 } from 'lucide-react';
import { SchoolMetadata, DistributionConfig } from '../types';
import { DEFAULT_METADATA } from '../utils/pdfGenerator';
import { DEFAULT_CONFIG } from '../utils/distributionEngine';
import { BackupRestoreModal } from './BackupRestoreModal';

export function Dashboard({ onSelectEvent }: { onSelectEvent: (eventId: number) => void }) {
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'year' | 'event', id: number, name: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const academicYears = useLiveQuery(() => db.academicYears.toArray());
  const assessmentEvents = useLiveQuery(
    () => selectedYearId ? db.assessmentEvents.where('academicYearId').equals(selectedYearId).toArray() : [],
    [selectedYearId]
  );

  const handleAddYear = async () => {
    if (newYearName.trim()) {
      const id = await db.academicYears.add({ name: newYearName.trim() });
      setSelectedYearId(id);
      setIsAddingYear(false);
      setNewYearName('');
    }
  };

  const handleAddEvent = async () => {
    if (newEventName.trim() && selectedYearId) {
      const selectedYear = academicYears?.find(y => y.id === selectedYearId);
      const id = await db.assessmentEvents.add({
        academicYearId: selectedYearId,
        name: newEventName.trim(),
        createdAt: new Date(),
        metadata: {
          ...DEFAULT_METADATA,
          tahunAjaran: selectedYear?.name || DEFAULT_METADATA.tahunAjaran
        },
        config: DEFAULT_CONFIG
      });
      
      onSelectEvent(id);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || confirmText !== 'HAPUS') return;

    if (deleteTarget.type === 'event') {
      await db.transaction('rw', [db.assessmentEvents, db.students, db.rooms], async () => {
        await db.students.where('assessmentEventId').equals(deleteTarget.id).delete();
        await db.rooms.where('assessmentEventId').equals(deleteTarget.id).delete();
        await db.assessmentEvents.delete(deleteTarget.id);
      });
    } else if (deleteTarget.type === 'year') {
      await db.transaction('rw', [db.academicYears, db.assessmentEvents, db.students, db.rooms], async () => {
        const events = await db.assessmentEvents.where('academicYearId').equals(deleteTarget.id).toArray();
        const eventIds = events.map(e => e.id!);
        
        if (eventIds.length > 0) {
          await db.students.where('assessmentEventId').anyOf(eventIds).delete();
          await db.rooms.where('assessmentEventId').anyOf(eventIds).delete();
        }
        await db.assessmentEvents.where('academicYearId').equals(deleteTarget.id).delete();
        await db.academicYears.delete(deleteTarget.id);
      });
      if (selectedYearId === deleteTarget.id) setSelectedYearId(null);
    }
    
    setDeleteTarget(null);
    setConfirmText('');
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 relative">
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <AlertTriangle className="w-5 h-5" />
                Hapus {deleteTarget.type === 'year' ? 'Tahun Ajaran' : 'Kegiatan'}
              </div>
              <button 
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4 text-sm leading-relaxed">
                Yakin hapus <strong>{deleteTarget.name}</strong>? 
                <br /><br />
                <span className="text-red-600 font-semibold">Tindakan ini tidak dapat dibatalkan.</span> Semua data terkait akan terhapus permanen.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">Ketik <strong>HAPUS</strong> untuk konfirmasi:</label>
                <input 
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="HAPUS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none font-mono text-center uppercase tracking-widest"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button 
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                disabled={confirmText !== 'HAPUS'}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header with Backup & Restore Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-teal-600" />
            Sistem Administrasi Ruang & Denah Ujian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen pembagian ruang, denah meja silang jenjang, cetak dokumen, dan arsip offline
          </p>
        </div>

        <button
          onClick={() => setIsBackupModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 cursor-pointer shrink-0"
          title="Buka Pusat Cadangan & Pemulihan Data"
        >
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Cadangkan & Pulihkan</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-800 mb-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            <h2 className="text-xl font-bold">Pilih Tahun Ajaran</h2>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            {academicYears?.map(year => (
              <div key={year.id} className="relative group inline-flex">
                <button
                  onClick={() => setSelectedYearId(year.id!)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex-1 ${
                    selectedYearId === year.id 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {year.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ type: 'year', id: year.id!, name: year.name });
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center shadow-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                  title="Hapus Tahun Ajaran"
                >
                  <X className="w-3 h-3" />
                </button>
                {/* Mobile delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ type: 'year', id: year.id!, name: year.name });
                  }}
                  className={`ml-1 px-2 py-2 rounded-lg border text-red-500 md:hidden ${
                    selectedYearId === year.id ? 'border-teal-600 bg-teal-50' : 'border-slate-300 bg-white'
                  }`}
                  title="Hapus Tahun Ajaran"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {isAddingYear ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="2026/2027"
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-32 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddYear()}
                  autoFocus
                />
                <button onClick={handleAddYear} className="p-1.5 bg-teal-100 text-teal-700 rounded-md hover:bg-teal-200">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingYear(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-400 text-slate-500 hover:text-slate-700 hover:border-slate-600 flex items-center gap-2 transition-colors"
                title="Tambah Tahun Ajaran Baru"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            )}
          </div>
        </div>

        {selectedYearId && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Folder className="w-5 h-5 text-slate-400" />
                Daftar Kegiatan
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {assessmentEvents?.map(event => (
                <div key={event.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white flex flex-col">
                  <h3 className="font-semibold text-slate-800 mb-1">{event.name}</h3>
                  <p className="text-xs text-slate-500 mb-4 flex-1">
                    Dibuat: {event.createdAt.toLocaleDateString('id-ID')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSelectEvent(event.id!)}
                      className="flex-1 bg-slate-900 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Buka
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: 'event', id: event.id!, name: event.name })}
                      className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      title="Hapus Kegiatan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[140px] bg-slate-50">
                {isAddingEvent ? (
                  <div className="w-full space-y-2">
                    <input
                      type="text"
                      placeholder="Nama Kegiatan (ex: Ujian Semester)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddEvent} className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg text-xs font-medium">Simpan</button>
                      <button onClick={() => setIsAddingEvent(false)} className="flex-1 bg-slate-200 text-slate-700 py-1.5 rounded-lg text-xs font-medium">Batal</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingEvent(true)}
                    className="flex flex-col items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Buat Kegiatan Baru</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
}
