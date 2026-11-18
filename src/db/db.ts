import Dexie, { Table } from 'dexie';
import { DistributionConfig, SchoolMetadata, Room } from '../types';

export interface AcademicYear {
  id?: number;
  name: string; // e.g., "2026/2027"
}

export interface AssessmentEvent {
  id?: number;
  academicYearId: number;
  name: string; // e.g., "Sumatif Akhir Semester Ganjil"
  createdAt: Date;
  metadata: SchoolMetadata;
  config: DistributionConfig;
}

export interface StudentRecord {
  id?: number;
  assessmentEventId: number;
  nisn: string;
  nis: string;
  nama: string;
  gender: 'L' | 'P';
  kelas: string;
  nilai: number | string;
}

export interface RoomRecord {
  id?: number;
  assessmentEventId: number;
  roomData: Room;
}

export interface AppSetting {
  key: string;
  value: any;
}

export class AppDatabase extends Dexie {
  academicYears!: Table<AcademicYear, number>;
  assessmentEvents!: Table<AssessmentEvent, number>;
  students!: Table<StudentRecord, number>;
  rooms!: Table<RoomRecord, number>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super('AplikasiPembagianRuangDB');
    this.version(1).stores({
      academicYears: '++id, name',
      assessmentEvents: '++id, academicYearId, name',
      students: '++id, assessmentEventId, kelas, nama, nisn',
      rooms: '++id, assessmentEventId'
    });
    this.version(2).stores({
      appSettings: 'key'
    });
  }
}

export const db = new AppDatabase();
