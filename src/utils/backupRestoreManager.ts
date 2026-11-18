import { db } from '../db/db';

export interface BackupMetadata {
  app: string;
  version: string;
  exportedAt: string;
  schemaVersion: number;
  schoolName?: string;
  academicYear?: string;
  eventName?: string;
  stats: {
    academicYearsCount: number;
    eventsCount: number;
    studentsCount: number;
    roomsCount: number;
    settingsCount: number;
    hasLogos: boolean;
    hasSignatures: boolean;
    hasStamp: boolean;
  };
  checksum: string;
}

export interface BackupPayload {
  header: BackupMetadata;
  data: {
    academicYears: any[];
    assessmentEvents: any[];
    students: any[];
    rooms: any[];
    appSettings: any[];
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: BackupMetadata;
  payload?: BackupPayload;
}

// Generate simple integrity hash for backup payload
function generateIntegrityHash(data: any): string {
  const str = JSON.stringify({
    years: data.academicYears?.length || 0,
    events: data.assessmentEvents?.length || 0,
    students: data.students?.length || 0,
    rooms: data.rooms?.length || 0,
    settings: data.appSettings?.length || 0
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `HASH_${Math.abs(hash).toString(16).toUpperCase()}_${data.students?.length || 0}S`;
}

/**
 * Creates a complete backup of all local IndexedDB data.
 */
export async function createFullBackup(activeEventId?: number): Promise<{ blob: Blob; filename: string; metadata: BackupMetadata }> {
  const [academicYears, assessmentEvents, students, rooms, appSettings] = await Promise.all([
    db.academicYears.toArray(),
    db.assessmentEvents.toArray(),
    db.students.toArray(),
    db.rooms.toArray(),
    db.appSettings.toArray()
  ]);

  // Find active event if available to name the file nicely
  const activeEvent = activeEventId ? assessmentEvents.find(e => e.id === activeEventId) : assessmentEvents[0];
  const schoolName = activeEvent?.metadata?.namaSekolah || 'Sekolah';
  const academicYear = activeEvent?.metadata?.tahunAjaran || '2026-2027';
  const eventName = activeEvent?.name || 'Asesmen';

  const hasLogos = appSettings.some(s => s.key === 'logoKiri' || s.key === 'logoKanan');
  const hasSignatures = appSettings.some(s => s.key === 'ttdKepalaSekolah' || s.key === 'ttdKetuaPelaksana');
  const hasStamp = appSettings.some(s => s.key === 'stempelSekolah');

  const rawData = {
    academicYears,
    assessmentEvents,
    students,
    rooms,
    appSettings
  };

  const metadata: BackupMetadata = {
    app: 'Sistem Administrasi Ruang & Denah Ujian',
    version: '2.0.0',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    schoolName,
    academicYear,
    eventName,
    stats: {
      academicYearsCount: academicYears.length,
      eventsCount: assessmentEvents.length,
      studentsCount: students.length,
      roomsCount: rooms.length,
      settingsCount: appSettings.length,
      hasLogos,
      hasSignatures,
      hasStamp
    },
    checksum: generateIntegrityHash(rawData)
  };

  const payload: BackupPayload = {
    header: metadata,
    data: rawData
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  // Clean filename
  const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = `BACKUP_UJIAN_${cleanSchool}_${dateStr}_${timeStr}.json`;

  return { blob, filename, metadata };
}

/**
 * Downloads the backup file directly to user device.
 */
export async function downloadBackup(activeEventId?: number): Promise<BackupMetadata> {
  const { blob, filename, metadata } = await createFullBackup(activeEventId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return metadata;
}

/**
 * Validates an uploaded backup file and returns its inspection metadata.
 */
export async function validateBackupFile(file: File): Promise<ValidationResult> {
  try {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      return { valid: false, error: 'Format berkas tidak valid. Harap pilih berkas berekstensi .json' };
    }

    const text = await file.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { valid: false, error: 'Berkas JSON rusak atau tidak dapat dibaca (Syntax Error).' };
    }

    // Support both Version 2 (header + data) and Version 1 (app + data)
    let payloadData: any;
    let metadata: BackupMetadata;

    if (json.header && json.data) {
      // V2 Format
      payloadData = json.data;
      metadata = json.header;
    } else if (json.data) {
      // V1 Format
      payloadData = json.data;
      metadata = {
        app: json.app || 'Sistem Administrasi Ruang & Denah Ujian',
        version: json.version || '1.0',
        schemaVersion: 1,
        exportedAt: json.exportedAt || new Date().toISOString(),
        schoolName: json.data?.currentMetadata?.namaSekolah || 'Sekolah',
        stats: {
          academicYearsCount: Array.isArray(payloadData.academicYears) ? payloadData.academicYears.length : 0,
          eventsCount: Array.isArray(payloadData.assessmentEvents) ? payloadData.assessmentEvents.length : 0,
          studentsCount: Array.isArray(payloadData.students) ? payloadData.students.length : 0,
          roomsCount: Array.isArray(payloadData.rooms) ? payloadData.rooms.length : 0,
          settingsCount: Array.isArray(payloadData.appSettings) ? payloadData.appSettings.length : 0,
          hasLogos: Array.isArray(payloadData.appSettings) && payloadData.appSettings.some((s: any) => s.key === 'logoKiri'),
          hasSignatures: Array.isArray(payloadData.appSettings) && payloadData.appSettings.some((s: any) => s.key === 'ttdKepalaSekolah'),
          hasStamp: Array.isArray(payloadData.appSettings) && payloadData.appSettings.some((s: any) => s.key === 'stempelSekolah')
        },
        checksum: 'LEGACY_V1'
      };
    } else {
      return { valid: false, error: 'Struktur data cadangan tidak dikenali atau tidak memiliki konten valid.' };
    }

    // Sanity checks on tables
    if (!Array.isArray(payloadData.students) && !Array.isArray(payloadData.rooms) && !Array.isArray(payloadData.assessmentEvents)) {
      return { valid: false, error: 'Berkas cadangan tidak memiliki tabel data siswa, ruang, atau asesmen yang valid.' };
    }

    return {
      valid: true,
      metadata,
      payload: {
        header: metadata,
        data: payloadData
      }
    };
  } catch (err: any) {
    return { valid: false, error: `Gagal membaca berkas: ${err.message || 'Kesalahan tidak terduga'}` };
  }
}

/**
 * Restores data atomically using Dexie transaction.
 */
export async function restoreBackupData(payload: BackupPayload): Promise<void> {
  const { data } = payload;

  await db.transaction('rw', [db.academicYears, db.assessmentEvents, db.students, db.rooms, db.appSettings], async () => {
    // 1. Academic Years
    if (Array.isArray(data.academicYears) && data.academicYears.length > 0) {
      await db.academicYears.clear();
      await db.academicYears.bulkAdd(data.academicYears);
    }

    // 2. Assessment Events
    if (Array.isArray(data.assessmentEvents) && data.assessmentEvents.length > 0) {
      await db.assessmentEvents.clear();
      // Ensure date objects are valid Date
      const cleanEvents = data.assessmentEvents.map((e: any) => ({
        ...e,
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date()
      }));
      await db.assessmentEvents.bulkAdd(cleanEvents);
    }

    // 3. Students
    if (Array.isArray(data.students) && data.students.length > 0) {
      await db.students.clear();
      await db.students.bulkAdd(data.students);
    }

    // 4. Rooms
    if (Array.isArray(data.rooms) && data.rooms.length > 0) {
      await db.rooms.clear();
      await db.rooms.bulkAdd(data.rooms);
    }

    // 5. App Settings (Logos, TTD, Stempel, preferences)
    if (Array.isArray(data.appSettings) && data.appSettings.length > 0) {
      await db.appSettings.clear();
      await db.appSettings.bulkAdd(data.appSettings);
    }
  });
}
