export interface Student {
  id: string;
  nomorPeserta: string;
  nisn: string;
  nis: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  jenjang: 7 | 8 | 9;
  kelasAsal: string;
  nilaiRataRata: number;
  nilaiMataPelajaran: Record<string, number>;
  peringkatJenjang?: number;
  peringkatKeseluruhan?: number;
  asalSekolah?: string;
  keterangan?: string;
}

export interface Seat {
  mejaNomor: number; // 1 to 32
  baris: number;     // 1 to 4
  kolom: number;     // 1 to 8
  pasanganMejaNomor: number; // The paired desk number (e.g., 1 pairs with 2)
  pairIndex: number; // 0 to 15 (16 pairs per room)
  positionInPair: 'left' | 'right';
  student: Student | null;
  isViolatingGender?: boolean;
  isViolatingGrade?: boolean;
  warningNote?: string;
}

export interface RoomStats {
  totalSiswa: number;
  kapasitas: number;
  lakiLaki: number;
  perempuan: number;
  kelas7: number;
  kelas8: number;
  kelas9: number;
  rataRataNilai: number;
  pairViolations: number;
}

export interface Room {
  id: number;
  nama: string;
  kapasitas: number;
  seats: Seat[];
  stats: RoomStats;
}

export type DistributionModel = 'tiered_homogen' | 'balanced_heterogen' | 'sequential';

export type CrossGradeStrategy = 
  | 'auto_multigrade' 
  | 'cross_9_8_7_rotational' 
  | 'cross_9_with_8_and_8_with_7'
  | 'cross_9_with_7';

export interface DistributionConfig {
  jumlahRuang: number;
  kapasitasPerRuang: number;
  modelPembagian: DistributionModel;
  dasarRanking: string; // 'average' or subject key
  strategiSilang: CrossGradeStrategy;
  utamakanRankingTinggiDiRuangAwal: boolean;
  wajibJenisKelaminSama: boolean;
  wajibJenjangBerbeda: boolean;
  prefixNomorPeserta: 'grade_based' | 'room_based' | 'keep_original';
}

export interface ExamScheduleItem {
  no: number | string;
  hariTanggal: string;
  waktu: string;
  mataPelajaran: string;
}

export interface SchoolMetadata {
  namaSekolah: string;
  kabupaten: string;
  alamat: string;
  telepon: string;
  namaUjian: string;
  singkatanUjian: string;
  tahunAjaran: string;
  semester: string;
  tanggalUjian: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  namaKetuaPanitia: string;
  nipKetuaPanitia: string;
  namaKetuaPelaksana?: string;
  nipKetuaPelaksana?: string;
  penandatanganKartu?: 'kepala_sekolah' | 'ketua_pelaksana';
  pengawasDefault1: string;
  pengawasDefault2: string;
  tanggalCetakKartu?: string;
  catatanKartu?: string;
  jadwalUjian?: ExamScheduleItem[];
  cekKehadiranMapel?: string[];
}

export interface ValidationSummary {
  totalMurid: number;
  muridDitempatkan: number;
  muridBelumDitempatkan: number;
  totalPasangan: number;
  pasanganValid: number;
  pelanggaranJenjang: number;
  pelanggaranGender: number;
  status: 'Sempurna' | 'Peringatan' | 'Perlu Penyesuaian';
  details: string[];
}

export type PdfDocType = 
  | 'denah' 
  | 'daftar_hadir' 
  | 'peserta_ruang' 
  | 'cek_kehadiran' 
  | 'rekapitulasi' 
  | 'label_meja' 
  | 'berita_acara'
  | 'kartu_peserta';

export type ActiveTab = 'students' | 'config' | 'seating' | 'documents' | 'analytics';

export type AppTheme = 'calm_slate' | 'warm_paper' | 'soft_teal' | 'subtle_indigo';
