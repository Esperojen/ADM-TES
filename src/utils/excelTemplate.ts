import * as XLSX from 'xlsx';
import { Student } from '../types';

/**
 * Downloads a complete and user-friendly Excel (.xlsx) template for student data preparation.
 * Includes formatted headers, realistic sample data covering grades 7-9, and a dedicated guide sheet.
 */
export const downloadStudentTemplateExcel = (filename = 'Template_Data_Siswa_Ujian.xlsx') => {
  const wb = XLSX.utils.book_new();

  // 1. DATA SHEET
  const headers = [
    'NO',
    'NISN',
    'NIS',
    'NAMA LENGKAP',
    'JENIS KELAMIN',
    'KELAS',
    'NILAI',
    'ASAL SEKOLAH',
    'KETERANGAN'
  ];

  const sampleRows = [
    [1, '0122784074', '1878', 'ACHMAD MUTAQIN AL HASAN', 'L', '7A', 88.5, 'SDN 1 Karangsalam', 'Peserta Reguler'],
    [2, '0123589354', '1904', 'ADELIA PUSPITA SARI', 'P', '7A', 91.25, 'SDN 2 Kalikembang', 'Peserta Reguler'],
    [3, '0124719283', '1930', 'ADITTIYA AZZIS PRATAMA', 'L', '7B', 82.0, 'SDN 1 Karangsalam', 'Peserta Reguler'],
    [4, '0125829103', '1954', 'ALYA NUR AZIZAH', 'P', '7B', 86.75, 'SDN 3 Karangsari', 'Peserta Reguler'],
    [5, '0115629481', '1742', 'BAGAS DWI PRASETYO', 'L', '8A', 84.0, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [6, '0114829103', '1765', 'CANTIKA PUTRI LESTARI', 'P', '8A', 89.75, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [7, '0117829102', '1780', 'FAHRI NUR IRAWAN', 'L', '8B', 81.5, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [8, '0118930192', '1805', 'GITA KHAIRUNNISA', 'P', '8B', 90.0, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [9, '0108392104', '1580', 'DIMAS ADITYA PRATAMA', 'L', '9A', 92.8, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [10, '0107294810', '1602', 'ELSA NUR RAHMAWATI', 'P', '9A', 87.5, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [11, '0109281723', '1625', 'IKHSAN MAULANA', 'L', '9B', 85.0, 'SMPN 2 Kemranjen', 'Peserta Reguler'],
    [12, '0106192834', '1648', 'JASMINE PUTRI SALSABILA', 'P', '9B', 93.5, 'SMPN 2 Kemranjen', 'Peserta Reguler']
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths definition for comfortable editing in Microsoft Excel
  ws['!cols'] = [
    { wch: 6 },  // NO
    { wch: 16 }, // NISN
    { wch: 12 }, // NIS
    { wch: 32 }, // NAMA LENGKAP
    { wch: 16 }, // JENIS KELAMIN
    { wch: 12 }, // KELAS
    { wch: 14 }, // NILAI
    { wch: 28 }, // ASAL SEKOLAH
    { wch: 22 }  // KETERANGAN
  ];

  // Set explicit text type for NISN and NIS cells to prevent leading zeros from disappearing
  for (let r = 1; r <= sampleRows.length; r++) {
    const nisnCell = XLSX.utils.encode_cell({ r, c: 1 });
    const nisCell = XLSX.utils.encode_cell({ r, c: 2 });
    if (ws[nisnCell]) ws[nisnCell].t = 's';
    if (ws[nisCell]) ws[nisCell].t = 's';
  }

  XLSX.utils.book_append_sheet(wb, ws, 'DATA SISWA');

  // 2. PETUNJUK PENGISIAN SHEET
  const instructions = [
    ['PETUNJUK PENGISIAN TEMPLATE DATA SISWA'],
    ['Sistem Pembagian Ruang Tes & Denah Tempat Duduk Ujian'],
    [''],
    ['KOLOM', 'STATUS', 'CONTOH PENGISIAN', 'PENJELASAN & REKOMENDASI'],
    ['NO', 'Opsional', '1, 2, 3', 'Nomor urut data siswa.'],
    ['NISN', 'Wajib / Sangat Dianjurkan', '0122784074', '10 digit NISN nasional. Di MS Excel, atur format kolom sebagai "Text" agar angka 0 di depan tidak terhapus.'],
    ['NIS', 'Opsional', '1878', 'Nomor Induk Siswa lokal / NIPD sekolah.'],
    ['NAMA LENGKAP', 'Wajib', 'ACHMAD MUTAQIN AL HASAN', 'Nama lengkap siswa sesuai akta / rapor. Huruf kapital atau Title Case diperbolehkan.'],
    ['JENIS KELAMIN', 'Wajib', 'L atau P', 'Ketik "L" untuk Laki-laki atau "P" untuk Perempuan. Digunakan untuk validasi aturan tempat duduk 1 meja sejenis.'],
    ['KELAS', 'Wajib', '7A, 7B, 8A, 8B, 9A, dst.', 'Kelas / Rombel asal siswa. Karakter angka 7, 8, atau 9 otomatis dideteksi sistem untuk algoritma silang jenjang.'],
    ['NILAI', 'Dianjurkan', '88.5 atau 88,5', 'Nilai rata-rata rapor / nilai seleksi / skor ujian. Digunakan untuk perangkingan dan distribusi berimbang ke tiap ruang ujian.'],
    ['ASAL SEKOLAH', 'Opsional', 'SDN 1 Karangsalam', 'Nama sekolah asal siswa (bermanfaat untuk kartu peserta dan arsip).'],
    ['KETERANGAN', 'Opsional', 'Peserta Reguler / Susulan', 'Catatan tambahan panitia ujian.'],
    [''],
    ['TIPS IMPORT DATA:'],
    ['1. Jangan mengubah nama kolom pada baris pertama (Header).'],
    ['2. Anda dapat menghapus data contoh (baris 2 sampai 13) dan menggantinya dengan data siswa Anda.'],
    ['3. Simpan file tetap dalam format Excel (.xlsx) atau Comma Separated Values (.csv).'],
    ['4. Aplikasi juga mendukung file ekspor langsung dari Dapodik (Daftar Peserta Didik format .xlsx).'],
    ['5. Setelah file siap, buka menu "Data Siswa", klik "Import Excel / CSV", lalu pilih file Anda.']
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(instructions);
  wsGuide['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 30 },
    { wch: 80 }
  ];

  XLSX.utils.book_append_sheet(wb, wsGuide, 'PETUNJUK PENGISIAN');

  // Trigger download
  XLSX.writeFile(wb, filename);
};

/**
 * Downloads CSV template
 */
export const downloadStudentTemplateCsv = (filename = 'Template_Data_Siswa.csv') => {
  const csvContent = 
`NO,NISN,NIS,NAMA LENGKAP,JENIS KELAMIN,KELAS,NILAI,ASAL SEKOLAH,KETERANGAN
1,0122784074,1878,ACHMAD MUTAQIN AL HASAN,L,7A,88.5,SDN 1 Karangsalam,Peserta Reguler
2,0123589354,1904,ADELIA PUSPITA SARI,P,7A,91.25,SDN 2 Kalikembang,Peserta Reguler
3,0115629481,1742,BAGAS DWI PRASETYO,L,8A,84.0,SMPN 2 Kemranjen,Peserta Reguler
4,0114829103,1765,CANTIKA PUTRI LESTARI,P,8A,89.75,SMPN 2 Kemranjen,Peserta Reguler
5,0108392104,1580,DIMAS ADITYA PRATAMA,L,9A,92.8,SMPN 2 Kemranjen,Peserta Reguler
6,0107294810,1602,ELSA NUR RAHMAWATI,P,9A,87.5,SMPN 2 Kemranjen,Peserta Reguler`;

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Exports current students in the system to an Excel (.xlsx) file
 */
export const exportStudentsToExcel = (students: Student[], filename = 'Data_Siswa_Ujian.xlsx') => {
  const wb = XLSX.utils.book_new();

  const headers = [
    'NO',
    'NO PESERTA',
    'NISN',
    'NIS',
    'NAMA SISWA',
    'L/P',
    'JENJANG',
    'KELAS ASAL',
    'NILAI RATA-RATA',
    'PERINGKAT JENJANG',
    'PERINGKAT KESELURUHAN',
    'ASAL SEKOLAH',
    'KETERANGAN'
  ];

  const rows = students.map((s, idx) => [
    idx + 1,
    s.nomorPeserta || '-',
    s.nisn,
    s.nis,
    s.nama,
    s.jenisKelamin,
    s.jenjang,
    s.kelasAsal,
    s.nilaiRataRata,
    s.peringkatJenjang ?? '-',
    s.peringkatKeseluruhan ?? '-',
    s.asalSekolah || '-',
    s.keterangan || '-'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 32 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 28 },
    { wch: 20 }
  ];

  // Force string format for NISN and NIS
  for (let r = 1; r <= rows.length; r++) {
    const pCell = XLSX.utils.encode_cell({ r, c: 1 });
    const nisnCell = XLSX.utils.encode_cell({ r, c: 2 });
    const nisCell = XLSX.utils.encode_cell({ r, c: 3 });
    if (ws[pCell]) ws[pCell].t = 's';
    if (ws[nisnCell]) ws[nisnCell].t = 's';
    if (ws[nisCell]) ws[nisCell].t = 's';
  }

  XLSX.utils.book_append_sheet(wb, ws, 'DATA SISWA');
  XLSX.writeFile(wb, filename);
};
