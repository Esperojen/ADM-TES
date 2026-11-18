import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Student, 
  Room, 
  DistributionConfig, 
  SchoolMetadata, 
  ActiveTab, 
  AppTheme 
} from '../types';
import { 
  distributeStudentsToRooms, 
  DEFAULT_CONFIG, 
  validateRoomAllocation,
  swapStudentSeats
} from '../utils/distributionEngine';
import { DEFAULT_METADATA } from '../utils/pdfGenerator';
import { Navbar } from './Navbar';
import { TabsNavigation } from './TabsNavigation';
import { StudentDataTab } from './StudentDataTab';
import { ConfigTab } from './ConfigTab';
import { SeatingPlanTab } from './SeatingPlanTab';
import { PdfDocumentsTab } from './PdfDocumentsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { BackupRestoreModal } from './BackupRestoreModal';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import { ArrowLeft } from 'lucide-react';

interface WorkspaceProps {
  eventId: number;
  onBack: () => void;
  activeTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

export function Workspace({ eventId, onBack, activeTheme, onThemeChange }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('students');
  const [selectedRoomId, setSelectedRoomId] = useState<number>(1);
  const [targetPdfRoomId, setTargetPdfRoomId] = useState<number | undefined>(undefined);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);

  const event = useLiveQuery(() => db.assessmentEvents.get(eventId), [eventId]);
  const studentsRecord = useLiveQuery(() => db.students.where('assessmentEventId').equals(eventId).toArray(), [eventId]);
  const roomsRecord = useLiveQuery(() => db.rooms.where('assessmentEventId').equals(eventId).toArray(), [eventId]);

  const students = useMemo<Student[]>(() => {
    if (!studentsRecord) return [];
    const counters: Record<number, number> = { 7: 1, 8: 1, 9: 1 };
    
    // Sort students by kelas then nama to ensure consistent numbering
    const sortedRecords = [...studentsRecord].sort((a, b) => {
      if (a.kelas === b.kelas) return a.nama.localeCompare(b.nama);
      return a.kelas.localeCompare(b.kelas);
    });

    return sortedRecords.map(r => {
      const jenjang = (parseInt(r.kelas.replace(/[^0-9]/g, '')) || 7) as 7|8|9;
      const noPeserta = `${String(jenjang).padStart(2, '0')}-${String(counters[jenjang]++).padStart(3, '0')}`;
      
      return {
        id: r.id?.toString() || '',
        nomorPeserta: noPeserta,
        nisn: r.nisn,
        nis: r.nis,
        nama: r.nama,
        jenisKelamin: r.gender,
        jenjang,
        kelasAsal: r.kelas,
        nilaiRataRata: typeof r.nilai === 'number' ? r.nilai : parseFloat(r.nilai) || 0,
        nilaiMataPelajaran: {},
        peringkatKeseluruhan: typeof r.nilai === 'number' ? r.nilai : parseFloat(r.nilai) || 0,
      };
    });
  }, [studentsRecord]);

  const config = event?.config || DEFAULT_CONFIG;
  const metadata = event?.metadata || DEFAULT_METADATA;
  const rooms = useMemo(() => roomsRecord?.map(r => r.roomData) || [], [roomsRecord]);

  const saveConfig = async (newConfig: DistributionConfig) => {
    await db.assessmentEvents.update(eventId, { config: newConfig });
  };

  const saveMetadata = async (newMetadata: SchoolMetadata) => {
    await db.assessmentEvents.update(eventId, { metadata: newMetadata });
  };

  const saveRooms = async (newRooms: Room[]) => {
    await db.transaction('rw', db.rooms, async () => {
      await db.rooms.where('assessmentEventId').equals(eventId).delete();
      const records = newRooms.map(r => ({ assessmentEventId: eventId, roomData: r }));
      await db.rooms.bulkAdd(records);
    });
  };

  const runDistribution = async (currentStudents = students, currentConfig = config) => {
    const { rooms: newRooms } = distributeStudentsToRooms(currentStudents, currentConfig);
    await saveRooms(newRooms);
  };

  // Ensure Ruang 9 automatically updates if an existing record in IndexedDB still contains same-grade seatmates
  useEffect(() => {
    if (!students || students.length === 0 || !rooms || rooms.length === 0) return;
    const room9 = rooms.find(r => r.id === 9);
    if (room9) {
      let hasSameGradeInRoom9 = false;
      for (let pIdx = 0; pIdx < 16; pIdx++) {
        const left = room9.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left')?.student;
        const right = room9.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right')?.student;
        if (left && right && left.jenjang === right.jenjang) {
          hasSameGradeInRoom9 = true;
          break;
        }
      }
      if (hasSameGradeInRoom9) {
        runDistribution(students, config);
      }
    }
  }, [students, rooms, config]);

  const handleUpdateStudents = async (newStudents: Student[]) => {
    await db.transaction('rw', db.students, async () => {
      await db.students.where('assessmentEventId').equals(eventId).delete();
      const records = newStudents.map(s => ({
        assessmentEventId: eventId,
        nisn: s.nisn,
        nis: s.nis,
        nama: s.nama,
        gender: s.jenisKelamin,
        kelas: s.kelasAsal,
        nilai: s.peringkatKeseluruhan || s.nilaiRataRata || 0
      }));
      await db.students.bulkAdd(records);
    });
    // Immediately distribute
    const { rooms: newRooms } = distributeStudentsToRooms(newStudents, config);
    await saveRooms(newRooms);
  };

  const handleResetToInitial = async () => {
    // Left empty for now, maybe we remove this since it's dynamic
  };

  const handleSwapSeats = async (
    source: { roomId: number; mejaNomor: number },
    target: { roomId: number; mejaNomor: number }
  ) => {
    const updated = swapStudentSeats(rooms, source, target);
    await saveRooms(updated);
  };

  const validation = useMemo(() => {
    return validateRoomAllocation(rooms, students.length);
  }, [rooms, students.length]);

  const handleQuickPrint = () => {
    setTargetPdfRoomId(undefined);
    setActiveTab('documents');
  };

  const handleOpenPdfForRoom = (roomId: number) => {
    setTargetPdfRoomId(roomId);
    setActiveTab('documents');
  };

  if (!event) return null;

  return (
    <>
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors" title="Kembali ke Dashboard">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-sm font-semibold text-slate-700">
            {event.name}
          </div>
        </div>
      </div>
      
      <Navbar
        metadata={metadata}
        validation={validation}
        totalRooms={rooms.length}
        activeTheme={activeTheme}
        onThemeChange={onThemeChange}
        onQuickPrint={handleQuickPrint}
        onOpenBackupRestore={() => setIsBackupModalOpen(true)}
        onOpenGoogleSheetsSync={() => setIsGoogleSheetsModalOpen(true)}
      />

      <TabsNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        studentCount={students.length}
        roomCount={rooms.length}
        violationsCount={validation.pelanggaranGender + validation.pelanggaranJenjang}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
        {activeTab === 'students' && (
          <StudentDataTab
            students={students}
            onUpdateStudents={handleUpdateStudents}
            onResetToInitial={handleResetToInitial}
          />
        )}

        {activeTab === 'config' && (
          <ConfigTab
            config={config}
            metadata={metadata}
            students={students}
            onUpdateConfig={saveConfig}
            onUpdateMetadata={saveMetadata}
            onReapplyDistribution={() => runDistribution(students, config)}
          />
        )}

        {activeTab === 'seating' && (
          <SeatingPlanTab
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            metadata={metadata}
            onSelectRoom={setSelectedRoomId}
            onSwapSeats={handleSwapSeats}
            onOpenPdfForRoom={handleOpenPdfForRoom}
          />
        )}

        {activeTab === 'documents' && (
          <PdfDocumentsTab
            rooms={rooms}
            metadata={metadata}
            initialDocType="denah"
            initialRoomId={targetPdfRoomId}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            rooms={rooms}
            students={students}
            validation={validation}
            metadata={metadata}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 mt-auto no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">{metadata.namaSekolah}</span>
            <span>•</span>
            <span>Sistem Distribusi Ruang & Denah Ujian Terotomasi</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Kapasitas 32 Siswa (16 Pasang Meja) • Algoritma Silang Jenjang & Pemisahan Gender
          </div>
        </div>
      </footer>

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        activeEventId={eventId}
      />

      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        metadata={metadata}
        students={students}
        rooms={rooms}
      />
    </>
  );
}
