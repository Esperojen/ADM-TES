import { getAccessToken } from './googleAuth';
import { SchoolMetadata, Student, Room } from '../types';

export interface SyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt: string;
  totalStudents: number;
  totalRooms: number;
}

/**
 * Creates a new Google Spreadsheet with predefined sheets for Exam Room Administration.
 */
export async function createExamSpreadsheet(
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token otentikasi Google tidak tersedia. Silakan hubungkan akun Google Anda.');

  const requestBody = {
    properties: {
      title,
      locale: 'id_ID',
      timeZone: 'Asia/Jakarta'
    },
    sheets: [
      { properties: { title: 'Ringkasan & Info', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Data Semua Peserta', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Denah Per Ruangan', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Rekap Kehadiran', gridProperties: { frozenRowCount: 1 } } }
    ]
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal membuat spreadsheet: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
  };
}

/**
 * Ensures the target spreadsheet has the required sheets, adding any missing ones.
 */
async function ensureSheetsExist(spreadsheetId: string, token: string) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) return;

  const metaData = await metaRes.json();
  const existingTitles = (metaData.sheets || []).map((s: any) => s.properties?.title);
  const requiredTitles = ['Ringkasan & Info', 'Data Semua Peserta', 'Denah Per Ruangan', 'Rekap Kehadiran'];

  const requests: any[] = [];
  for (const title of requiredTitles) {
    if (!existingTitles.includes(title)) {
      requests.push({
        addSheet: {
          properties: {
            title,
            gridProperties: { frozenRowCount: 1 }
          }
        }
      });
    }
  }

  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
  }
}

/**
 * Syncs all student and room distribution data to the given Google Spreadsheet.
 */
export async function syncExamDataToSpreadsheet({
  spreadsheetId,
  metadata,
  students,
  rooms
}: {
  spreadsheetId: string;
  metadata: SchoolMetadata;
  students: Student[];
  rooms: Room[];
}): Promise<SyncResult> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token otentikasi Google tidak tersedia. Silakan masuk terlebih dahulu.');

  // 1. Ensure all sheets exist
  await ensureSheetsExist(spreadsheetId, token);

  const syncedAt = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  // 2. Build Sheet 1: Ringkasan & Info
  const summaryValues = [
    ['INFORMASI SISTEM ADMINISTRASI RUANG & DENAH UJIAN'],
    ['Nama Sekolah', metadata.namaSekolah || '-'],
    ['Nama Ujian / Asesmen', metadata.namaUjian || '-'],
    ['Tahun Ajaran', metadata.tahunAjaran || '-'],
    ['Tanggal Pelaksanaan', metadata.tanggalUjian || '-'],
    ['Kepala Sekolah', `${metadata.namaKepalaSekolah || '-'} (NIP: ${metadata.nipKepalaSekolah || '-'})`],
    ['Ketua Pelaksana', `${metadata.namaKetuaPelaksana || '-'} (NIP: ${metadata.nipKetuaPelaksana || '-'})`],
    ['Total Peserta Terdaftar', `${students.length} Siswa`],
    ['Total Ruangan Ujian', `${rooms.length} Ruang (Kapasitas 32 siswa/ruang)`],
    ['Waktu Sinkronisasi Terakhir', syncedAt],
    ['Status Sinkronisasi', 'Real-Time Aktif (Tersinkron ke Perangkat)'],
    [],
    ['JADWAL PELAKSANAAN UJIAN'],
    ['No', 'Hari & Tanggal', 'Sesi', 'Waktu', 'Mata Pelajaran 1', 'Mata Pelajaran 2']
  ];

  if (metadata.jadwalUjian && metadata.jadwalUjian.length > 0) {
    metadata.jadwalUjian.forEach((j, idx) => {
      summaryValues.push([
        (idx + 1).toString(),
        j.hariTanggal || '-',
        j.sesi || '1',
        j.waktu || '-',
        j.mataPelajaran1 || '-',
        j.mataPelajaran2 || '-'
      ]);
    });
  }

  // 3. Build Sheet 2: Data Semua Peserta
  // Map students to room & seat if assigned
  const studentSeatMap = new Map<string, { roomName: string; mejaNomor: number; posisi: string }>();
  rooms.forEach(r => {
    r.mejaList.forEach(m => {
      if (m.kiri) {
        studentSeatMap.set(m.kiri.id, {
          roomName: r.name,
          mejaNomor: m.nomor,
          posisi: 'Kiri'
        });
      }
      if (m.kanan) {
        studentSeatMap.set(m.kanan.id, {
          roomName: r.name,
          mejaNomor: m.nomor,
          posisi: 'Kanan'
        });
      }
    });
  });

  const participantValues = [
    [
      'No',
      'Nomor Peserta',
      'Ruang Ujian',
      'No. Meja',
      'Posisi Kursi',
      'Nama Siswa',
      'NISN',
      'NIS',
      'Kelas Asal',
      'Jenjang',
      'Jenis Kelamin'
    ]
  ];

  students.forEach((s, idx) => {
    const seat = studentSeatMap.get(s.id);
    participantValues.push([
      (idx + 1).toString(),
      s.nomorPeserta || '-',
      seat?.roomName || 'Belum Ditempatkan',
      seat ? seat.mejaNomor.toString() : '-',
      seat?.posisi || '-',
      s.nama,
      s.nisn || '-',
      s.nis || '-',
      s.kelasAsal,
      `Kelas ${s.jenjang}`,
      s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'
    ]);
  });

  // 4. Build Sheet 3: Denah Per Ruangan
  const seatingValues = [
    [
      'Ruang Ujian',
      'No. Meja',
      'Siswa Kursi Kiri (Nama)',
      'No. Peserta Kiri',
      'Kelas Kiri',
      'Siswa Kursi Kanan (Nama)',
      'No. Peserta Kanan',
      'Kelas Kanan',
      'Status Silang Jenjang',
      'Status Gender'
    ]
  ];

  rooms.forEach(r => {
    r.mejaList.forEach(m => {
      const left = m.kiri;
      const right = m.kanan;

      let silangStatus = 'Tunggal';
      if (left && right) {
        silangStatus = left.jenjang !== right.jenjang ? 'Silang Sempurna' : 'Jenjang Sama';
      }

      let genderStatus = '-';
      if (left && right) {
        genderStatus = left.jenisKelamin === right.jenisKelamin 
          ? `Sesama (${left.jenisKelamin === 'L' ? 'L' : 'P'})` 
          : 'Berbeda Gender (Peringatan)';
      }

      seatingValues.push([
        r.name,
        m.nomor.toString(),
        left ? left.nama : '(Kosong)',
        left ? left.nomorPeserta || '-' : '-',
        left ? left.kelasAsal : '-',
        right ? right.nama : '(Kosong)',
        right ? right.nomorPeserta || '-' : '-',
        right ? right.kelasAsal : '-',
        silangStatus,
        genderStatus
      ]);
    });
  });

  // 5. Build Sheet 4: Rekap Kehadiran
  const attendanceValues = [
    [
      'Ruang Ujian',
      'No. Meja',
      'No. Peserta',
      'Nama Siswa',
      'Kelas Asal',
      'Paraf Mapel 1',
      'Paraf Mapel 2',
      'Status Kehadiran',
      'Catatan Pengawas'
    ]
  ];

  rooms.forEach(r => {
    r.mejaList.forEach(m => {
      [m.kiri, m.kanan].forEach(student => {
        if (student) {
          attendanceValues.push([
            r.name,
            m.nomor.toString(),
            student.nomorPeserta || '-',
            student.nama,
            student.kelasAsal,
            '', // Paraf mapel 1
            '', // Paraf mapel 2
            'Hadir',
            ''
          ]);
        }
      });
    });
  });

  // 6. Clear and write all sheets in one batchUpdate
  const dataPayload = [
    {
      range: "'Ringkasan & Info'!A1:Z100",
      values: summaryValues
    },
    {
      range: "'Data Semua Peserta'!A1:K" + (participantValues.length + 10),
      values: participantValues
    },
    {
      range: "'Denah Per Ruangan'!A1:J" + (seatingValues.length + 10),
      values: seatingValues
    },
    {
      range: "'Rekap Kehadiran'!A1:I" + (attendanceValues.length + 10),
      values: attendanceValues
    }
  ];

  const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataPayload
    })
  });

  if (!updateResponse.ok) {
    const errData = await updateResponse.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal menulis data ke spreadsheet: ${updateResponse.statusText}`);
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId,
    spreadsheetUrl,
    syncedAt,
    totalStudents: students.length,
    totalRooms: rooms.length
  };
}
