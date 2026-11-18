import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Student } from '../types';

export const parseFileToStudents = async (file: File): Promise<Student[]> => {
  if (file.name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const students = results.data.map((row: any, index: number) => 
              mapRowToStudent(row, index)
            ).filter(s => s !== null) as Student[];
            resolve(students);
          } catch (e) {
            reject(e);
          }
        },
        error: (error) => reject(error)
      });
    });
  } else if (file.name.match(/\.xlsx?$/)) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find header row (the one that has 'nama' or 'nisn')
    let headerRowIdx = 0;
    for (let i = 0; i < json.length; i++) {
      const row = json[i] as any[];
      if (row.some(cell => typeof cell === 'string' && (cell.toLowerCase() === 'nama' || cell.toLowerCase() === 'nisn'))) {
        headerRowIdx = i;
        break;
      }
    }
    
    const headers = (json[headerRowIdx] as string[]).map(h => (h || '').toString().toLowerCase().trim());
    const students: Student[] = [];
    
    for (let i = headerRowIdx + 1; i < json.length; i++) {
      const row = json[i] as any[];
      if (!row || row.length === 0) continue;
      
      const rowData: any = {};
      headers.forEach((h, idx) => {
        if (h) rowData[h] = row[idx];
      });
      
      const student = mapRowToStudent(rowData, i);
      if (student) students.push(student);
    }
    
    return students;
  } else {
    throw new Error('Unsupported file format. Please use .csv or .xlsx');
  }
};

const mapRowToStudent = (row: any, index: number): Student | null => {
  // Try to find keys ignoring case and common formatting
  const getVal = (keys: string[]) => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(k => {
        const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized === target || k.toLowerCase().trim() === key.toLowerCase().trim();
      });
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey].toString().trim();
      }
    }
    return '';
  };

  const nisn = getVal(['nisn', 'no_usbn', 'no usbn', 'nomor peserta', 'no peserta']);
  const nis = getVal(['nis', 'nipd', 'no induk', 'nomor induk']);
  const nama = getVal(['nama', 'name', 'nama lengkap', 'nama siswa', 'nama peserta']);
  let jk = getVal(['gender', 'jk', 'jenis_kelamin', 'jenis kelamin', 'l/p', 'lp', 'sex']).toUpperCase();
  const kelas = getVal(['kelas', 'rombel', 'rombel saat ini', 'tingkat', 'kelas asal']);
  const nilaiStr = getVal(['nilai', 'rangking', 'peringkat', 'nilai rata-rata', 'nilai_rata_rata', 'rata-rata', 'skor']);
  const asalSekolah = getVal(['asal_sekolah', 'asal sekolah', 'sekolah asal', 'sekolah_asal']);
  const keterangan = getVal(['keterangan', 'ket', 'catatan']);
  
  if (!nama) return null; // Nama is required
  
  if (jk.startsWith('L') || jk === 'MALE' || jk === '1') jk = 'L';
  else if (jk.startsWith('P') || jk === 'FEMALE' || jk === '2') jk = 'P';
  else jk = 'L'; // default

  let jenjang: 7|8|9 = 7;
  const gradeMatch = kelas.match(/([789])/);
  if (gradeMatch) {
    jenjang = parseInt(gradeMatch[1]) as 7|8|9;
  }

  let nilai = parseFloat(nilaiStr.replace(',', '.'));
  if (isNaN(nilai)) nilai = 0;

  return {
    id: `STU_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
    nomorPeserta: '', // to be generated
    nisn,
    nis,
    nama,
    jenisKelamin: jk as 'L' | 'P',
    jenjang,
    kelasAsal: kelas || `${jenjang}`,
    nilaiRataRata: nilai,
    peringkatKeseluruhan: nilai,
    nilaiMataPelajaran: {},
    asalSekolah: asalSekolah || undefined,
    keterangan: keterangan || undefined
  };
};

export const exportStudentsToCsv = (students: Student[]) => {
  const data = students.map(s => ({
    NISN: s.nisn,
    NIS: s.nis,
    NAMA: s.nama,
    GENDER: s.jenisKelamin,
    KELAS: s.kelasAsal,
    NILAI: s.nilaiRataRata
  }));
  
  return Papa.unparse(data);
};

export const exportRoomAllocationToCsv = (rooms: import('../types').Room[]) => {
  const data: any[] = [];
  rooms.forEach(r => {
    r.seats.forEach(s => {
      if (s.student) {
        data.push({
          RUANG: r.nama,
          MEJA: s.mejaNomor,
          NISN: s.student.nisn,
          NAMA: s.student.nama,
          KELAS: s.student.kelasAsal,
          GENDER: s.student.jenisKelamin,
        });
      }
    });
  });
  return Papa.unparse(data);
};
