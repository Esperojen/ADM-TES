import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultLogoKiri, defaultLogoKanan } from '../data/defaultLogos';
import { Room, SchoolMetadata, PdfDocType } from '../types';
import { DEFAULT_JADWAL_TKA1 } from '../utils/pdfGenerator';

interface A4DocumentPreviewProps {
  docType: PdfDocType;
  rooms: Room[];
  metadata: SchoolMetadata;
  selectedRoomId?: number | 'all';
  currentPageIndex: number;
  zoomScale: number;
  showAllPages?: boolean;
  filterTingkat?: 'all' | '7' | '8' | '9';
  filterKelas?: 'all' | string;
  sortBy?: 'ruang' | 'kelas';
}

export const A4DocumentPreview: React.FC<A4DocumentPreviewProps> = ({
  docType,
  rooms,
  metadata,
  selectedRoomId = 'all',
  currentPageIndex,
  zoomScale,
  showAllPages = false,
  filterTingkat,
  filterKelas,
  sortBy
}) => {
  const targetRooms = selectedRoomId === 'all'
    ? rooms
    : rooms.filter(r => r.id === selectedRoomId);

  // Compute pages to render based on docType
  const renderPages = () => {
    switch (docType) {
      case 'denah':
        return targetRooms.map((room, idx) => (
          <DenahPage
            key={room.id}
            room={room}
            metadata={metadata}
            pageNum={idx + 1}
            totalPages={targetRooms.length}
          />
        ));
      case 'daftar_hadir':
        return targetRooms.map((room, idx) => (
          <DaftarHadirPage
            key={room.id}
            room={room}
            metadata={metadata}
            pageNum={idx + 1}
            totalPages={targetRooms.length}
          />
        ));
      case 'peserta_ruang':
        return targetRooms.map((room, idx) => (
          <PesertaRuangPage
            key={room.id}
            room={room}
            metadata={metadata}
            pageNum={idx + 1}
            totalPages={targetRooms.length}
          />
        ));
      case 'cek_kehadiran':
        return targetRooms.map((room, idx) => (
          <CekKehadiranPage
            key={room.id}
            room={room}
            metadata={metadata}
            pageNum={idx + 1}
            totalPages={targetRooms.length}
          />
        ));
      case 'rekapitulasi':
        return [
          <RekapitulasiPage
            key="rekap"
            rooms={rooms}
            metadata={metadata}
            pageNum={1}
            totalPages={1}
          />
        ];
      case 'label_meja': {
        // 8 cards per page with filtering and sorting
        let allStudents: any[] = [];
        targetRooms.forEach(room => {
          const sortedSeats = [...room.seats].sort((a, b) => a.mejaNomor - b.mejaNomor);
          sortedSeats.forEach(s => {
            if (s.student) {
              if (filterTingkat && filterTingkat !== 'all' && String(s.student.jenjang) !== filterTingkat) return;
              if (filterKelas && filterKelas !== 'all' && s.student.kelasAsal !== filterKelas) return;
              allStudents.push({ ...s.student, mejaNomor: s.mejaNomor, roomName: room.nama, roomId: room.id });
            }
          });
        });

        if (sortBy === 'kelas') {
          allStudents.sort((a, b) => {
            const cmpKelas = (a.kelasAsal || '').localeCompare(b.kelasAsal || '', undefined, { numeric: true });
            if (cmpKelas !== 0) return cmpKelas;
            return (a.nomorPeserta || a.nama).localeCompare(b.nomorPeserta || b.nama, undefined, { numeric: true });
          });
        }

        const chunks: typeof allStudents[] = [];
        for (let i = 0; i < allStudents.length; i += 8) {
          chunks.push(allStudents.slice(i, i + 8));
        }

        const totalPages = Math.max(chunks.length, 1);
        return chunks.map((chunk, chunkIdx) => (
          <LabelMejaPage
            key={`label-${chunkIdx}`}
            cards={chunk}
            metadata={metadata}
            pageNum={chunkIdx + 1}
            totalPages={totalPages}
          />
        ));
      }
      case 'berita_acara':
        return targetRooms.map((room, idx) => (
          <BeritaAcaraPage
            key={room.id}
            room={room}
            metadata={metadata}
            pageNum={idx + 1}
            totalPages={targetRooms.length}
          />
        ));
      case 'kartu_peserta': {
        const pages: React.ReactNode[] = [];
        let allStudents: Array<{ student: any; roomName: string; roomId: number; mejaNomor: number }> = [];
        targetRooms.forEach(room => {
          const roomStudents = room.seats
            .filter(s => s.student !== null)
            .sort((a, b) => a.mejaNomor - b.mejaNomor)
            .map(s => ({ student: s.student!, roomName: room.nama, roomId: room.id, mejaNomor: s.mejaNomor }));
          allStudents = allStudents.concat(roomStudents);
        });

        // 4 cards per page
        const chunks: typeof allStudents[] = [];
        for (let i = 0; i < allStudents.length; i += 4) {
          chunks.push(allStudents.slice(i, i + 4));
        }

        chunks.forEach((chunk, chunkIdx) => {
          pages.push(
            <KartuPesertaPreviewPage
              key={`kartu-${chunkIdx}`}
              cards={chunk}
              metadata={metadata}
              pageNum={chunkIdx + 1}
              totalPages={chunks.length}
            />
          );
        });
        return pages;
      }
      default:
        return null;
    }
  };

  const pages = renderPages() || [];
  const activePages = showAllPages
    ? pages
    : [pages[Math.min(currentPageIndex, Math.max(0, pages.length - 1))]];

  return (
    <div className="flex flex-col items-center gap-8 py-4 select-text">
      {activePages.map((pageContent, idx) => (
        <div
          key={idx}
          className="print-page bg-white shadow-xl rounded-sm border border-slate-300 transition-transform origin-top"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            marginBottom: zoomScale < 1 ? `-${(1 - zoomScale) * 800}px` : '0px'
          }}
        >
          {pageContent}
        </div>
      ))}
    </div>
  );
};

// ----------------------------------------------------
// KOP SURAT RESMI (HEADER)
// ----------------------------------------------------
const KopSurat: React.FC<{ metadata: SchoolMetadata; isLandscape?: boolean }> = ({ metadata, isLandscape }) => {
  const logoKiriSetting = useLiveQuery(() => db.appSettings.get('logoKiri'));
  const logoKananSetting = useLiveQuery(() => db.appSettings.get('logoKanan'));
  const logoKiriSrc = logoKiriSetting?.value || defaultLogoKiri;
  const logoKananSrc = logoKananSetting?.value || defaultLogoKanan;
  const kabLines = metadata.kabupaten.split('\n');

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-4">
        {logoKiriSrc && (
          <div className="flex-shrink-0 flex items-center justify-center">
            <img 
              src={logoKiriSrc} 
              alt="Logo Kabupaten Banyumas" 
              className={`${isLandscape ? 'h-14' : 'h-13'} w-auto max-w-[55px] object-contain`} 
            />
          </div>
        )}
        <div className="flex-1 text-center">
          {kabLines.map((line, i) => (
            <div key={i} className="text-xs font-bold uppercase tracking-wider text-slate-800 leading-tight">
              {line.trim()}
            </div>
          ))}
          <div className={`${isLandscape ? 'text-lg' : 'text-base sm:text-lg'} font-black text-slate-900 tracking-wide mt-0.5`}>
            {metadata.namaSekolah}
          </div>
          <div className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
            {metadata.alamat}
          </div>
        </div>
        {logoKananSrc && (
          <div className="flex-shrink-0 flex items-center justify-center">
            <img 
              src={logoKananSrc} 
              alt="Logo Sekolah" 
              className={`${isLandscape ? 'h-14' : 'h-13'} w-auto max-w-[55px] object-contain`} 
            />
          </div>
        )}
      </div>
      {/* Double Border Line Kop - snug right against the logos and text without blank gap */}
      <div className="mt-1.5 border-b-2 border-slate-900" />
      <div className="mt-0.5 border-b border-slate-900" />
    </div>
  );
};

// ----------------------------------------------------
// 1. DENAH TEMPAT DUDUK (Landscape A4: 297mm x 210mm)
// ----------------------------------------------------
const DenahPage: React.FC<{
  room: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ room, metadata, pageNum, totalPages }) => {
  const ttdKetuaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));
  const ttdKepalaSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const stempelSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  return (
    <div
      className="p-8 box-border text-slate-900"
      style={{ width: '1050px', minHeight: '740px' }}
    >
      <KopSurat metadata={metadata} isLandscape />

      <div className="text-center my-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          DENAH TEMPAT DUDUK PESERTA {metadata.namaUjian}
        </h2>
        <p className="text-xs font-bold text-slate-700">
          TAHUN AJARAN {metadata.tahunAjaran} — <span className="text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{room.nama.toUpperCase()}</span>
        </p>
      </div>

      {/* Front of Room: Blackboard & Supervisor Desk & Door */}
      <div className="flex items-center justify-between gap-4 mt-3 mb-4">
        <div className="px-3 py-1.5 bg-slate-100 border border-slate-400 rounded text-center text-xs font-bold text-slate-700 shadow-2xs w-28">
          🚪 PINTU MASUK
        </div>
        <div className="flex-1 py-1.5 bg-slate-800 text-white rounded text-center text-xs font-bold tracking-wider shadow-2xs border border-slate-900">
          [ PAPAN TULIS & MEJA PENGAWAS RUANG ]
        </div>
        <div className="w-28 text-right text-[11px] font-semibold text-slate-500">
          Kapasitas: 32 Kursi
        </div>
      </div>

      {/* 4 Rows x 8 Columns Grid (4 pairs per row separated by aisles) */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map(rowNum => (
          <div key={rowNum} className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(pairIdx => {
              const leftCol = pairIdx * 2 + 1;
              const rightCol = pairIdx * 2 + 2;
              const leftMejaNum = (rowNum - 1) * 8 + leftCol;
              const rightMejaNum = (rowNum - 1) * 8 + rightCol;

              const leftSeat = room.seats.find(s => s.mejaNomor === leftMejaNum);
              const rightSeat = room.seats.find(s => s.mejaNomor === rightMejaNum);

              return (
                <div key={pairIdx} className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/70 border border-slate-300 rounded-lg">
                  <DeskBox seat={leftSeat} mejaNum={leftMejaNum} />
                  <DeskBox seat={rightSeat} mejaNum={rightMejaNum} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info & Signatures */}
      <div className="mt-4 pt-3 border-t border-slate-200 flex items-start justify-between text-xs">
        <div className="space-y-1 text-[11px] text-slate-600">
          <div className="font-bold text-slate-800">Keterangan Denah:</div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-500 inline-block" />
              <span>Laki-laki: <strong>{room.stats.lakiLaki}</strong></span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-pink-100 border border-pink-500 inline-block" />
              <span>Perempuan: <strong>{room.stats.perempuan}</strong></span>
            </span>
            <span>Total Terisi: <strong>{room.stats.totalSiswa} / 32</strong></span>
          </div>
          <div className="text-[10px] text-slate-400">
            Hal. {pageNum} dari {totalPages} — Dicetak Otomatis
          </div>
        </div>

        <div className="flex space-x-14 text-center text-xs">
          <div className="w-44 text-left">
            <div className="text-[11px] text-slate-500">Ketua Pelaksana Ujian,</div>
            <div className="relative h-12 my-1 flex items-center justify-center">
              {ttdKetuaSetting?.value && (
                <img 
                  src={ttdKetuaSetting.value} 
                  alt="TTD Ketua" 
                  className="h-10 w-auto max-w-[105px] object-contain" 
                />
              )}
            </div>
            <div className="font-bold underline text-slate-900">{metadata.namaKetuaPelaksana || metadata.namaKetuaPanitia}</div>
            <div className="text-[10px] text-slate-500">NIP. {metadata.nipKetuaPelaksana || metadata.nipKetuaPanitia}</div>
          </div>
          <div className="w-44 text-left">
            <div className="text-[11px] text-slate-500">Mengetahui, Kepala Sekolah</div>
            <div className="relative h-12 my-1 flex items-center">
              {ttdKepalaSetting?.value && (
                <img 
                  src={ttdKepalaSetting.value} 
                  alt="TTD Kepsek" 
                  className={`absolute ${stempelSetting?.value ? 'left-6' : 'left-3'} top-1 h-10 w-auto max-w-[105px] object-contain z-0`} 
                />
              )}
              {stempelSetting?.value && (
                <img 
                  src={stempelSetting.value} 
                  alt="Stempel" 
                  className={`absolute ${ttdKepalaSetting?.value ? 'left-0.5' : 'left-2'} top-0.5 h-11 w-11 object-contain pointer-events-none z-10 mix-blend-multiply opacity-90`} 
                />
              )}
            </div>
            <div className="font-bold underline text-slate-900">{metadata.namaKepalaSekolah}</div>
            <div className="text-[10px] text-slate-500">NIP. {metadata.nipKepalaSekolah}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeskBox: React.FC<{ seat: any; mejaNum: number }> = ({ seat, mejaNum }) => {
  const student = seat?.student;
  const isMale = student?.jenisKelamin === 'L';

  return (
    <div
      className={`p-1.5 rounded-md border flex flex-col justify-between h-[74px] text-[10px] ${
        student
          ? isMale
            ? 'bg-blue-50/90 border-blue-400 text-slate-900'
            : 'bg-pink-50/90 border-pink-400 text-slate-900'
          : 'bg-white border-slate-200 text-slate-400 border-dashed'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`px-1.5 py-0.2 rounded font-black text-[9px] ${
            student
              ? isMale
                ? 'bg-blue-600 text-white'
                : 'bg-pink-600 text-white'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          M-{String(mejaNum).padStart(2, '0')}
        </span>
        {student && (
          <span className="font-bold text-[9px] text-slate-600">
            {student.kelasAsal} ({student.jenisKelamin})
          </span>
        )}
      </div>

      {student ? (
        <div className="my-0.5 space-y-0.5">
          <div className="flex items-center justify-between text-[8px] text-slate-600 font-mono">
            <span className="truncate max-w-[55px]">No: {student.nomorPeserta || '-'}</span>
            <span className="font-bold text-slate-800">NISN: {student.nisn || '-'}</span>
          </div>
          <div className="font-bold text-[9.5px] line-clamp-1 leading-tight text-slate-900" title={student.nama}>
            {student.nama}
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-[9px] italic text-slate-300">
          [ Kosong ]
        </div>
      )}

      {student && (
        <div className="flex items-center justify-between text-[8px] text-slate-600 border-t border-slate-200/60 pt-0.5">
          <span>Rnk #{student.peringkatJenjang}</span>
          <span className="font-bold">Avg {student.nilaiRataRata.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// 2. DAFTAR HADIR PESERTA (Portrait A4: 210mm x 297mm)
// ----------------------------------------------------
const DaftarHadirPage: React.FC<{
  room: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ room, metadata, pageNum, totalPages }) => {
  const seats = room.seats.slice(0, 32);

  return (
    <div
      className="p-8 box-border text-slate-900"
      style={{ width: '800px', minHeight: '1050px' }}
    >
      <KopSurat metadata={metadata} />

      <div className="text-center my-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          DAFTAR HADIR PESERTA {metadata.namaUjian}
        </h2>
        <p className="text-xs font-bold text-slate-700">
          TAHUN AJARAN {metadata.tahunAjaran}
        </p>
      </div>

      {/* Meta Box info */}
      <div className="grid grid-cols-2 gap-2 text-xs border border-slate-300 p-2.5 rounded-lg my-2.5 bg-slate-50/80">
        <div>
          <div><span className="font-semibold text-slate-600 inline-block w-28">Ruang Ujian</span>: <strong className="text-slate-900">{room.nama}</strong></div>
          <div><span className="font-semibold text-slate-600 inline-block w-28">Mata Pelajaran</span>: ........................................</div>
        </div>
        <div>
          <div><span className="font-semibold text-slate-600 inline-block w-28">Hari / Tanggal</span>: {metadata.tanggalUjian}</div>
          <div><span className="font-semibold text-slate-600 inline-block w-28">Waktu / Sesi</span>: ........... s.d. ........... WIB</div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-left text-[10px] border-collapse border border-slate-400 mt-2">
        <thead>
          <tr className="bg-slate-200/90 text-slate-800 text-[10px] font-bold">
            <th className="border border-slate-400 p-1 text-center w-7">No</th>
            <th className="border border-slate-400 p-1 text-center w-12">Meja</th>
            <th className="border border-slate-400 p-1 text-center w-24">NISN / NIS</th>
            <th className="border border-slate-400 p-1">Nama Lengkap Peserta</th>
            <th className="border border-slate-400 p-1 text-center w-12">Kelas</th>
            <th className="border border-slate-400 p-1 text-center w-8">L/P</th>
            <th className="border border-slate-400 p-1 text-center w-40" colSpan={2}>Tanda Tangan</th>
          </tr>
        </thead>
        <tbody>
          {seats.map((seat, idx) => {
            const student = seat.student;
            const isOdd = (idx + 1) % 2 !== 0;

            return (
              <tr key={seat.mejaNomor} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="border border-slate-300 p-0.5 text-center font-medium">{idx + 1}</td>
                <td className="border border-slate-300 p-0.5 text-center font-bold font-mono">M-{String(seat.mejaNomor).padStart(2, '0')}</td>
                <td className="border border-slate-300 p-0.5 text-center font-mono text-[9px]">{student?.nisn || '-'}</td>
                <td className="border border-slate-300 p-0.5 font-semibold">{student?.nama || <span className="text-slate-300 italic">- Kosong -</span>}</td>
                <td className="border border-slate-300 p-0.5 text-center">{student?.kelasAsal || '-'}</td>
                <td className="border border-slate-300 p-0.5 text-center">{student?.jenisKelamin || '-'}</td>
                {/* Odd sign in left column, Even sign in right column */}
                <td className="border border-slate-300 p-0.5 w-20 text-[9px]">
                  {isOdd && student ? `${idx + 1}. .............` : ''}
                </td>
                <td className="border border-slate-300 p-0.5 w-20 text-[9px]">
                  {!isOdd && student ? `${idx + 1}. .............` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary and Signatures */}
      <div className="mt-3 flex items-start justify-between text-xs pt-2">
        <div className="border border-slate-300 p-2 rounded bg-slate-50 text-[10px] space-y-0.5">
          <div className="font-bold text-slate-800">Rekapitulasi Kehadiran:</div>
          <div>Jumlah Terdaftar : <strong>{room.stats.totalSiswa}</strong> Siswa</div>
          <div>Jumlah Hadir : ........... Siswa</div>
          <div>Jumlah Tidak Hadir : ........... Siswa</div>
        </div>

        <div className="flex space-x-8 text-center text-xs">
          <div>
            <div className="text-[10px] text-slate-500">Pengawas Ruang I,</div>
            <div className="h-10" />
            <div className="font-bold underline text-slate-900">............................................</div>
            <div className="text-[9px] text-slate-500">NIP. ........................................</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Pengawas Ruang II,</div>
            <div className="h-10" />
            <div className="font-bold underline text-slate-900">............................................</div>
            <div className="text-[9px] text-slate-500">NIP. ........................................</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 3. DAFTAR PESERTA PER RUANG (Portrait A4)
// ----------------------------------------------------
const PesertaRuangPage: React.FC<{
  room: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ room, metadata, pageNum, totalPages }) => {
  const ttdKetuaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));
  const ttdKepalaSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const stempelSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  const students = room.seats
    .filter(s => s.student !== null)
    .map(s => ({ ...s.student!, mejaNomor: s.mejaNomor }));

  return (
    <div
      className="p-8 box-border text-slate-900"
      style={{ width: '800px', minHeight: '1050px' }}
    >
      <KopSurat metadata={metadata} />

      <div className="text-center my-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          DAFTAR PESERTA UJIAN PER RUANG
        </h2>
        <p className="text-xs font-bold text-slate-700">
          {metadata.namaUjian.toUpperCase()} — {room.nama.toUpperCase()} (TOTAL {students.length} SISWA)
        </p>
      </div>

      <table className="w-full text-left text-[10px] border-collapse border border-slate-400 mt-3">
        <thead>
          <tr className="bg-slate-200/90 text-slate-800 text-[10px] font-bold">
            <th className="border border-slate-400 p-1 text-center w-7">No</th>
            <th className="border border-slate-400 p-1 text-center w-12">Meja</th>
            <th className="border border-slate-400 p-1 text-center w-24">NISN</th>
            <th className="border border-slate-400 p-1">Nama Lengkap Peserta</th>
            <th className="border border-slate-400 p-1 text-center w-14">Kelas Asal</th>
            <th className="border border-slate-400 p-1 text-center w-8">L/P</th>
            <th className="border border-slate-400 p-1 text-center w-16">Peringkat</th>
            <th className="border border-slate-400 p-1 text-center w-16">Rata Nilai</th>
          </tr>
        </thead>
        <tbody>
          {students.map((st, idx) => (
            <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="border border-slate-300 p-1 text-center font-medium">{idx + 1}</td>
              <td className="border border-slate-300 p-1 text-center font-bold font-mono">M-{String(st.mejaNomor).padStart(2, '0')}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-[9px]">{st.nisn}</td>
              <td className="border border-slate-300 p-1 font-semibold">{st.nama}</td>
              <td className="border border-slate-300 p-1 text-center">{st.kelasAsal}</td>
              <td className="border border-slate-300 p-1 text-center">{st.jenisKelamin}</td>
              <td className="border border-slate-300 p-1 text-center font-semibold">#{st.peringkatJenjang}</td>
              <td className="border border-slate-300 p-1 text-center font-mono font-bold text-teal-800">{st.nilaiRataRata.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <div className="mt-6 flex items-start justify-between text-xs pt-4 border-t border-slate-200">
        <div className="text-[10px] text-slate-500">
          <div>Dicetak pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
          <div>Ruang {room.id} ({room.stats.totalSiswa} Siswa | {room.stats.lakiLaki} L, {room.stats.perempuan} P)</div>
        </div>

        <div className="flex space-x-12 text-center text-xs">
          <div className="w-44 text-left">
            <div className="text-[10px] text-slate-500">Ketua Pelaksana Ujian,</div>
            <div className="relative h-12 my-1 flex items-center justify-center">
              {ttdKetuaSetting?.value && (
                <img 
                  src={ttdKetuaSetting.value} 
                  alt="TTD Ketua" 
                  className="h-10 w-auto max-w-[105px] object-contain" 
                />
              )}
            </div>
            <div className="font-bold underline text-slate-900">{metadata.namaKetuaPelaksana || metadata.namaKetuaPanitia}</div>
            <div className="text-[9px] text-slate-500">NIP. {metadata.nipKetuaPelaksana || metadata.nipKetuaPanitia}</div>
          </div>
          <div className="w-44 text-left">
            <div className="text-[10px] text-slate-500">Mengetahui, Kepala Sekolah</div>
            <div className="relative h-12 my-1 flex items-center">
              {ttdKepalaSetting?.value && (
                <img 
                  src={ttdKepalaSetting.value} 
                  alt="TTD Kepsek" 
                  className={`absolute ${stempelSetting?.value ? 'left-6' : 'left-3'} top-1 h-10 w-auto max-w-[105px] object-contain z-0`} 
                />
              )}
              {stempelSetting?.value && (
                <img 
                  src={stempelSetting.value} 
                  alt="Stempel" 
                  className={`absolute ${ttdKepalaSetting?.value ? 'left-0.5' : 'left-2'} top-0.5 h-11 w-11 object-contain pointer-events-none z-10 mix-blend-multiply opacity-90`} 
                />
              )}
            </div>
            <div className="font-bold underline text-slate-900">{metadata.namaKepalaSekolah}</div>
            <div className="text-[9px] text-slate-500">NIP. {metadata.nipKepalaSekolah}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 4. CEK KEHADIRAN SESI (Portrait F4)
// ----------------------------------------------------
const CekKehadiranPage: React.FC<{
  room: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ room, metadata, pageNum, totalPages }) => {
  const ttdKetuaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));

  const students = room.seats
    .filter(s => s.student !== null)
    .map(s => ({ ...s.student!, mejaNomor: s.mejaNomor }));

  const mapelList = (metadata.cekKehadiranMapel && metadata.cekKehadiranMapel.length === 2)
    ? metadata.cekKehadiranMapel
    : ['Literasi', 'Numerasi'];

  const mapel1 = mapelList[0] || 'Literasi';
  const mapel2 = mapelList[1] || 'Numerasi';

  return (
    <div
      className="p-8 box-border text-slate-900 bg-white"
      style={{ width: '800px', minHeight: '1224px' }}
    >
      <KopSurat metadata={metadata} />

      <div className="text-center my-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          DAFTAR CEK KEHADIRAN PESERTA {metadata.singkatanUjian.toUpperCase()}
        </h2>
        <p className="text-xs font-bold text-slate-700">
          TAHUN AJARAN {metadata.tahunAjaran} — {room.nama.toUpperCase()}
        </p>
      </div>

      {/* Informasi Ruang & Jadwal Presisi */}
      <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-800 mb-3 px-1">
        <div className="space-y-1">
          <div className="flex"><span className="w-24 text-slate-500">Ruang</span><span className="font-bold text-slate-900">: {room.nama}</span></div>
          <div className="flex"><span className="w-24 text-slate-500">Jumlah Peserta</span><span className="font-semibold text-slate-800">: {students.length} Orang</span></div>
        </div>
        <div className="space-y-1">
          <div className="flex"><span className="w-28 text-slate-500">Hari / Tanggal</span><span className="text-slate-800">: {metadata.tanggalUjian || '...........................'}</span></div>
          <div className="flex"><span className="w-28 text-slate-500">Tahun Ajaran</span><span className="text-slate-800">: {metadata.tahunAjaran}</span></div>
        </div>
      </div>

      {/* Tabel Kehadiran 2 Kolom Mapel: Literasi & Numerasi */}
      <table className="w-full text-left text-[9.5px] border-collapse border border-slate-400">
        <thead>
          <tr className="bg-slate-100 text-slate-900 font-bold">
            <th className="border border-slate-400 p-1.5 text-center w-8" rowSpan={2}>No</th>
            <th className="border border-slate-400 p-1.5 text-center w-28" rowSpan={2}>No. Peserta</th>
            <th className="border border-slate-400 p-1.5 text-left" rowSpan={2}>Nama Lengkap Peserta</th>
            <th className="border border-slate-400 p-1.5 text-center w-14" rowSpan={2}>Kelas</th>
            <th className="border border-slate-400 p-1.5 text-center" colSpan={2}>Mata Pelajaran Ujian</th>
            <th className="border border-slate-400 p-1.5 text-center w-14" rowSpan={2}>Ket.</th>
          </tr>
          <tr className="bg-slate-200/80 text-slate-800 font-bold text-center">
            <th className="border border-slate-400 p-1.5 w-28">{mapelList[0]}</th>
            <th className="border border-slate-400 p-1.5 w-28">{mapelList[1]}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((st, idx) => (
            <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
              <td className="border border-slate-300 p-1.5 text-center font-medium">{idx + 1}</td>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-[9px]">{st.nomorPeserta || st.nisn}</td>
              <td className="border border-slate-300 p-1.5 font-semibold text-slate-900">{st.nama}</td>
              <td className="border border-slate-300 p-1.5 text-center">{st.kelasAsal}</td>
              <td className="border border-slate-300 p-1.5 text-center text-slate-300">
                <div className="w-4 h-4 mx-auto border border-slate-300 rounded-sm"></div>
              </td>
              <td className="border border-slate-300 p-1.5 text-center text-slate-300">
                <div className="w-4 h-4 mx-auto border border-slate-300 rounded-sm"></div>
              </td>
              <td className="border border-slate-300 p-1.5 text-center text-slate-400"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-800">
            <td className="border border-slate-400 p-1.5 text-right" colSpan={4}>Jumlah Peserta Hadir</td>
            <td className="border border-slate-400 p-1.5 text-center text-slate-600 font-normal">....... orang</td>
            <td className="border border-slate-400 p-1.5 text-center text-slate-600 font-normal">....... orang</td>
            <td className="border border-slate-400 p-1.5"></td>
          </tr>
          <tr className="bg-slate-100 font-bold text-slate-800">
            <td className="border border-slate-400 p-1.5 text-right" colSpan={4}>Jumlah Peserta Tidak Hadir</td>
            <td className="border border-slate-400 p-1.5 text-center text-slate-600 font-normal">....... orang</td>
            <td className="border border-slate-400 p-1.5 text-center text-slate-600 font-normal">....... orang</td>
            <td className="border border-slate-400 p-1.5"></td>
          </tr>
        </tfoot>
      </table>

      {/* Petunjuk Teknis Kehadiran */}
      <div className="mt-2 text-[9.5px] italic text-slate-500">
        * Petunjuk: Beri tanda centang (✓) atau paraf pada kolom kehadiran. Tulis (S) Sakit, (I) Izin, (A) Alpa jika peserta tidak hadir.
      </div>

      {/* Tanda Tangan: Pengawas Ruang Hari Pertama (Kiri) & Pengawas Ruang Hari Kedua (Kanan) */}
      <div className="mt-6 grid grid-cols-2 gap-8 text-xs pt-4 border-t border-slate-200">
        {/* Kolom Kiri: Pengawas Ruang Hari Pertama */}
        <div className="space-y-2.5 text-left border border-slate-200 rounded p-3 bg-slate-50/40">
          <div>
            <div className="font-bold text-slate-900 text-[11px]">Pengawas Ruang — Hari Pertama ({mapel1})</div>
            <div className="text-[10px] text-slate-500">Hari / Tgl : ..............................................................</div>
          </div>
          
          <div className="space-y-1 text-slate-800 text-[10.5px] pt-1">
            <div className="font-semibold text-slate-700">Pengawas Ruang :</div>
            <div className="pl-3 space-y-1 text-[10px]">
              <div>Nama : .....................................................................</div>
              <div>NIP &nbsp;&nbsp; : .....................................................................</div>
              <div className="pt-1">TTD &nbsp; : ( ............................................................... )</div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Pengawas Ruang Hari Kedua */}
        <div className="space-y-2.5 text-left border border-slate-200 rounded p-3 bg-slate-50/40">
          <div>
            <div className="font-bold text-slate-900 text-[11px]">Pengawas Ruang — Hari Kedua ({mapel2})</div>
            <div className="text-[10px] text-slate-500">Hari / Tgl : ..............................................................</div>
          </div>
          
          <div className="space-y-1 text-slate-800 text-[10.5px] pt-1">
            <div className="font-semibold text-slate-700">Pengawas Ruang :</div>
            <div className="pl-3 space-y-1 text-[10px]">
              <div>Nama : .....................................................................</div>
              <div>NIP &nbsp;&nbsp; : .....................................................................</div>
              <div className="pt-1">TTD &nbsp; : ( ............................................................... )</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 5. REKAPITULASI PEMBAGIAN RUANG (Portrait A4)
// ----------------------------------------------------
const RekapitulasiPage: React.FC<{
  rooms: Room[];
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ rooms, metadata }) => {
  const ttdKetuaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));
  const ttdKepalaSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const stempelSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  // Compute classes and matrix
  const allOriginalClasses = Array.from(
    new Set(
      rooms.flatMap(r => r.seats.filter(s => s.student !== null).map(s => s.student!.kelasAsal))
    )
  ).sort();

  return (
    <div
      className="p-8 box-border text-slate-900"
      style={{ width: '800px', minHeight: '1050px' }}
    >
      <KopSurat metadata={metadata} />

      <div className="text-center my-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          REKAPITULASI PEMBAGIAN RUANG UJIAN
        </h2>
        <p className="text-xs font-bold text-slate-700">
          MATRIKS SEBARAN KELAS ASAL TERHADAP RUANG TES ({metadata.tahunAjaran})
        </p>
      </div>

      <table className="w-full text-left text-[10px] border-collapse border border-slate-400 mt-4">
        <thead>
          <tr className="bg-slate-200/90 text-slate-800 font-bold">
            <th className="border border-slate-400 p-1 text-center w-8">No</th>
            <th className="border border-slate-400 p-1 text-center w-20">Kelas Asal</th>
            {rooms.map(r => (
              <th key={r.id} className="border border-slate-400 p-1 text-center">
                {r.nama.replace('Ruang ', 'R-')}
              </th>
            ))}
            <th className="border border-slate-400 p-1 text-center bg-slate-300 w-16">Total</th>
          </tr>
        </thead>
        <tbody>
          {allOriginalClasses.map((cls, idx) => {
            let rowTotal = 0;
            return (
              <tr key={cls} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="border border-slate-300 p-1 text-center font-medium">{idx + 1}</td>
                <td className="border border-slate-300 p-1 text-center font-bold">{cls}</td>
                {rooms.map(r => {
                  const count = r.seats.filter(s => s.student?.kelasAsal === cls).length;
                  rowTotal += count;
                  return (
                    <td key={r.id} className="border border-slate-300 p-1 text-center">
                      {count > 0 ? <strong className="text-slate-800">{count}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                  );
                })}
                <td className="border border-slate-300 p-1 text-center font-black bg-slate-100 text-slate-900">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-200 text-slate-900 font-black">
            <td colSpan={2} className="border border-slate-400 p-1 text-center">TOTAL SISWA</td>
            {rooms.map(r => (
              <td key={r.id} className="border border-slate-400 p-1 text-center font-bold">
                {r.stats.totalSiswa}
              </td>
            ))}
            <td className="border border-slate-400 p-1 text-center bg-teal-100 text-teal-950 font-black">
              {rooms.reduce((sum, r) => sum + r.stats.totalSiswa, 0)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signatures */}
      <div className="mt-8 flex items-start justify-between text-xs pt-4 border-t border-slate-200">
        <div className="w-44 text-left">
          <div className="text-[10px] text-slate-500">Ketua Pelaksana Ujian,</div>
          <div className="relative h-12 my-1 flex items-center justify-center">
            {ttdKetuaSetting?.value && (
              <img 
                src={ttdKetuaSetting.value} 
                alt="TTD Ketua" 
                className="h-10 w-auto max-w-[105px] object-contain" 
              />
            )}
          </div>
          <div className="font-bold underline text-slate-900">{metadata.namaKetuaPelaksana || metadata.namaKetuaPanitia}</div>
          <div className="text-[9px] text-slate-500">NIP. {metadata.nipKetuaPelaksana || metadata.nipKetuaPanitia}</div>
        </div>

        <div className="w-44 text-left">
          <div className="text-[10px] text-slate-500">Mengetahui, Kepala Sekolah</div>
          <div className="relative h-12 my-1 flex items-center">
            {ttdKepalaSetting?.value && (
              <img 
                src={ttdKepalaSetting.value} 
                alt="TTD Kepsek" 
                className={`absolute ${stempelSetting?.value ? 'left-6' : 'left-3'} top-1 h-10 w-auto max-w-[105px] object-contain z-0`} 
              />
            )}
            {stempelSetting?.value && (
              <img 
                src={stempelSetting.value} 
                alt="Stempel" 
                className={`absolute ${ttdKepalaSetting?.value ? 'left-0.5' : 'left-2'} top-0.5 h-11 w-11 object-contain pointer-events-none z-10 mix-blend-multiply opacity-90`} 
              />
            )}
          </div>
          <div className="font-bold underline text-slate-900">{metadata.namaKepalaSekolah}</div>
          <div className="text-[9px] text-slate-500">NIP. {metadata.nipKepalaSekolah}</div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 6. LABEL MEJA / KARTU PESERTA (8 Cards per A4 Page)
// ----------------------------------------------------
const LabelMejaPage: React.FC<{
  cards: any[];
  room?: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ cards, metadata, pageNum, totalPages }) => {
  const ttdKepalaSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const stempelSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  return (
    <div
      className="p-6 box-border text-slate-900 bg-white"
      style={{ width: '800px', minHeight: '1050px' }}
    >
      <div className="text-center mb-3">
        <div className="text-[10px] uppercase font-bold text-slate-500">
          LABEL MEJA PESERTA UJIAN — LEMBAR {pageNum} DARI {totalPages}
        </div>
        <div className="text-xs font-black text-slate-900 uppercase">
          {metadata.namaSekolah} — {metadata.namaUjian}
        </div>
      </div>

      {/* 2 columns x 4 rows grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((student, idx) => (
          <div
            key={idx}
            className="border border-slate-300 p-2.5 rounded-lg bg-white relative flex flex-col justify-between shadow-2xs"
            style={{ height: '228px' }}
          >
            {/* Header banner */}
            <div className="bg-slate-900 text-white px-2 py-1 rounded text-center">
              <div className="text-[9.5px] font-black uppercase leading-tight tracking-wide">
                {metadata.namaSekolah}
              </div>
              <div className="text-[7.5px] text-slate-300 font-semibold">
                LABEL MEJA PESERTA {metadata.singkatanUjian || metadata.namaUjian} ({metadata.tahunAjaran})
              </div>
            </div>

            {/* Sub-bar: Room & Meja + Barcode */}
            <div className="flex items-center justify-between mt-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
              <div className="text-[9px] font-black text-slate-800 uppercase">
                {student.roomName} — MEJA {String(student.mejaNomor).padStart(2, '0')}
              </div>
              <div className="font-mono text-[8px] font-bold text-slate-500">
                |||| || ||| |||||
              </div>
            </div>

            {/* Student Info */}
            <div className="text-[9.5px] space-y-0.5 mt-1 px-1 text-slate-700">
              <div className="flex">
                <span className="w-18 text-slate-500 text-[8.5px]">Nama Lengkap</span>
                <span className="text-slate-400 mr-1">:</span>
                <strong className="text-slate-900 font-black text-[9.5px] truncate flex-1">{student.nama}</strong>
              </div>
              <div className="flex">
                <span className="w-18 text-slate-500 text-[8.5px]">NISN / No. Pes</span>
                <span className="text-slate-400 mr-1">:</span>
                <span className="font-semibold text-slate-800">{student.nisn || '-'} / {student.nomorPeserta || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-18 text-slate-500 text-[8.5px]">Kelas Asal</span>
                <span className="text-slate-400 mr-1">:</span>
                <span className="font-semibold text-slate-800">{student.kelasAsal} ({student.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'})</span>
              </div>
            </div>

            <div className="border-t border-slate-200 my-1"></div>

            {/* Bottom section: Petunjuk on left, TTD & Stempel Kepala Sekolah on right */}
            <div className="flex items-end justify-between px-1 pb-0.5">
              {/* Left: Petunjuk Penempelan */}
              <div className="text-[7.5px] text-slate-500 leading-snug pb-1">
                <span className="font-semibold text-slate-600 block">* Petunjuk:</span>
                <span>Tempelkan pada sudut kanan<br />atas meja ujian peserta.</span>
              </div>

              {/* Right: TTD & Stempel Kepala Sekolah */}
              <div className="text-right flex flex-col items-end">
                <div className="text-[7.5px] text-slate-600">
                  {metadata.tanggalCetakKartu || metadata.tanggalUjian || 'Agustus 2026'}
                </div>
                <div className="text-[7.5px] font-semibold text-slate-700">Kepala Sekolah,</div>
                <div className="relative h-10 w-28 my-0.5 flex items-center justify-end">
                  {ttdKepalaSetting?.value && (
                    <img
                      src={ttdKepalaSetting.value}
                      alt="TTD Kepsek"
                      className="absolute right-1 top-0 h-9 w-auto max-w-[75px] object-contain z-0"
                    />
                  )}
                  {stempelSetting?.value && (
                    <img
                      src={stempelSetting.value}
                      alt="Stempel"
                      className="absolute right-10 top-0 h-10 w-10 object-contain pointer-events-none z-10 mix-blend-multiply opacity-90"
                    />
                  )}
                </div>
                <div className="text-[8px] font-black underline text-slate-900 leading-tight">
                  {metadata.namaKepalaSekolah}
                </div>
                <div className="text-[6.5px] text-slate-500 font-mono">
                  NIP. {metadata.nipKepalaSekolah}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 7. BERITA ACARA PELAKSANAAN UJIAN (Portrait A4)
// ----------------------------------------------------
const BeritaAcaraPage: React.FC<{
  room: Room;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}> = ({ room, metadata }) => {
  return (
    <div
      className="p-8 box-border text-slate-900"
      style={{ width: '800px', minHeight: '1050px' }}
    >
      <KopSurat metadata={metadata} />

      <div className="text-center my-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
          BERITA ACARA PELAKSANAAN UJIAN
        </h2>
        <p className="text-xs font-bold text-slate-700">
          {metadata.namaUjian.toUpperCase()} TAHUN AJARAN {metadata.tahunAjaran}
        </p>
      </div>

      <div className="text-xs leading-relaxed text-slate-800 mt-4 space-y-3">
        <p>
          Pada hari ini ......................... tanggal ........... bulan ........................ tahun {metadata.tahunAjaran.split('/')[0] || '20..'}, telah diselenggarakan <strong>{metadata.namaUjian}</strong> untuk:
        </p>

        <div className="grid grid-cols-[180px_1fr] gap-1.5 pl-4 text-xs font-medium">
          <div className="font-bold text-slate-700">Satuan Pendidikan</div>
          <div>: {metadata.namaSekolah}</div>

          <div className="font-bold text-slate-700">Ruang Ujian</div>
          <div>: <strong className="text-slate-900">{room.nama}</strong></div>

          <div className="font-bold text-slate-700">Mata Pelajaran</div>
          <div>: ....................................................................................................</div>

          <div className="font-bold text-slate-700">Waktu / Sesi</div>
          <div>: Pukul ............ s.d. ............ WIB (Sesi: ......)</div>

          <div className="font-bold text-slate-700">Jumlah Peserta Terdaftar</div>
          <div>: <strong>{room.stats.totalSiswa} Orang</strong> (Laki-laki: {room.stats.lakiLaki}, Perempuan: {room.stats.perempuan})</div>

          <div className="font-bold text-slate-700">Jumlah Peserta Hadir</div>
          <div>: ........... Orang</div>

          <div className="font-bold text-slate-700">Jumlah Peserta Tidak Hadir</div>
          <div>: ........... Orang (No. Meja: ...................................................)</div>
        </div>

        <div className="pt-2">
          <div className="font-bold text-slate-800 mb-1">Catatan Selama Pelaksanaan Ujian:</div>
          <div className="border border-slate-300 rounded p-3 h-28 text-[11px] text-slate-400 italic bg-slate-50/50">
            (Catat jika terdapat naskah rusak, peserta terlambat, pengawas pengganti, kejadian khusus, dll. Kosongkan jika berjalan tertib dan lancar)
          </div>
        </div>

        <p className="pt-2">
          Demikian Berita Acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-12 flex items-start justify-between text-xs px-6">
        <div className="text-center">
          <div className="text-slate-600">Pengawas Ruang I,</div>
          <div className="h-16" />
          <div className="font-bold underline text-slate-900">............................................................</div>
          <div className="text-[10px] text-slate-500">NIP. ....................................................</div>
        </div>

        <div className="text-center">
          <div className="text-slate-600">Pengawas Ruang II,</div>
          <div className="h-16" />
          <div className="font-bold underline text-slate-900">............................................................</div>
          <div className="text-[10px] text-slate-500">NIP. ....................................................</div>
        </div>
      </div>
    </div>
  );
};

interface KartuPesertaPreviewPageProps {
  cards: Array<{
    student: any;
    roomName: string;
    roomId: number;
    mejaNomor: number;
  }>;
  metadata: SchoolMetadata;
  pageNum: number;
  totalPages: number;
}

const KartuPesertaPreviewPage: React.FC<KartuPesertaPreviewPageProps> = ({
  cards,
  metadata
}) => {
  const logoKiriSetting = useLiveQuery(() => db.appSettings.get('logoKiri'));
  const logoKiriSrc = logoKiriSetting?.value || defaultLogoKiri;
  const ttdKetuaPelaksanaSetting = useLiveQuery(() => db.appSettings.get('ttdKetuaPelaksana'));
  const ttdKepalaSekolahSetting = useLiveQuery(() => db.appSettings.get('ttdKepalaSekolah'));
  const stempelSekolahSetting = useLiveQuery(() => db.appSettings.get('stempelSekolah'));

  const scheduleRows = metadata.jadwalUjian && metadata.jadwalUjian.length > 0
    ? metadata.jadwalUjian
    : DEFAULT_JADWAL_TKA1;

  const rowCount = scheduleRows.length;
  const tableHeadHeight = rowCount <= 2 ? '26px' : rowCount <= 4 ? '22px' : '18px';
  const tableRowHeight = rowCount <= 2 ? '78px' : rowCount <= 4 ? '42px' : rowCount <= 6 ? '28px' : '18px';
  const tableFontSize = rowCount <= 2 ? '9.5px' : rowCount <= 4 ? '8.5px' : rowCount <= 6 ? '8px' : '7.5px';

  return (
    <div className="w-[794px] min-h-[1123px] bg-white p-5 flex flex-col justify-between text-slate-800 text-xs">
      <div className="flex flex-col gap-2.5">
        {cards.map((card, idx) => {
          const s = card.student;
          return (
            <div key={idx} className="border border-slate-700 rounded-md p-2 flex flex-row gap-2.5 relative min-h-[245px] max-h-[258px]">
              {/* Left Box */}
              <div className="w-[51%] pr-2 border-r border-slate-400 flex flex-col justify-between">
                <div>
                  {/* Mini Kop */}
                  <div className="border-b-2 border-double border-slate-800 pb-1 mb-1.5 flex items-center gap-2">
                    {logoKiriSrc && (
                      <img src={logoKiriSrc} alt="Logo" className="h-8 w-auto max-w-[28px] object-contain flex-shrink-0" />
                    )}
                    <div className="flex-1 text-center">
                      <div className="text-[8px] font-bold uppercase leading-tight">PEMERINTAH KABUPATEN BANYUMAS</div>
                      <div className="text-[8px] font-bold uppercase leading-tight">DINAS PENDIDIKAN</div>
                      <div className="text-[9.5px] font-bold leading-tight mt-0.5">{metadata.namaSekolah}</div>
                      <div className="text-[7px] text-slate-500 leading-tight">{metadata.alamat}</div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center mb-1.5">
                    <div className="text-[10px] font-bold uppercase">KARTU PESERTA</div>
                    <div className="text-[8.5px] font-bold uppercase text-slate-700">{metadata.namaUjian}</div>
                    <div className="text-[7.5px] font-bold uppercase text-slate-600">TAHUN AJARAN {metadata.tahunAjaran}</div>
                  </div>

                  {/* Student Details (NISN di bawah nama) */}
                  <div className="text-[9px] space-y-0.5 mt-1">
                    <div className="flex">
                      <span className="w-16 text-slate-600">Nama</span>
                      <span className="w-2.5 text-slate-600">:</span>
                      <span className="font-bold text-slate-900 truncate">{s.nama}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 text-slate-600">NISN</span>
                      <span className="w-2.5 text-slate-600">:</span>
                      <span className="font-bold text-slate-900">{s.nisn || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 text-slate-600">Nomor Tes</span>
                      <span className="w-2.5 text-slate-600">:</span>
                      <span className="font-bold text-slate-900">{s.nomorPeserta || s.nisn}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 text-slate-600">Kelas</span>
                      <span className="w-2.5 text-slate-600">:</span>
                      <span className="font-bold text-slate-900">{s.kelasAsal}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 text-slate-600">Ruang</span>
                      <span className="w-2.5 text-slate-600">:</span>
                      <span className="font-bold text-slate-900">{card.roomName.replace(/Ruang\s*/i, '') || card.roomId}</span>
                    </div>
                  </div>
                </div>

                {/* TTD & Stempel (Kepala Sekolah atau Ketua Pelaksana) */}
                <div className="mt-1 flex flex-col justify-end">
                  <div className="self-end text-left text-[8.5px] relative pr-2 w-[160px]">
                    <div>{metadata.tanggalCetakKartu || 'Kemranjen, 19 Agustus 2026'}</div>
                    <div className="font-medium">
                      {metadata.penandatanganKartu === 'ketua_pelaksana' ? 'Ketua Pelaksana Ujian,' : 'Kepala Sekolah,'}
                    </div>
                    
                    {/* Wadah Tanda Tangan & Stempel */}
                    <div className="relative h-11 my-0.5 flex items-center">
                      {/* Scan TTD (Ketua Pelaksana atau Kepala Sekolah) */}
                      {metadata.penandatanganKartu === 'ketua_pelaksana' ? (
                        ttdKetuaPelaksanaSetting?.value && (
                          <img 
                            src={ttdKetuaPelaksanaSetting.value} 
                            alt="TTD Ketua Pelaksana" 
                            className="absolute left-7 top-0.5 h-10 w-auto max-w-[95px] object-contain z-0" 
                          />
                        )
                      ) : (
                        ttdKepalaSekolahSetting?.value && (
                          <img 
                            src={ttdKepalaSekolahSetting.value} 
                            alt="TTD Kepala Sekolah" 
                            className="absolute left-7 top-0.5 h-10 w-auto max-w-[95px] object-contain z-0" 
                          />
                        )
                      )}
                      {/* Stempel Sekolah (didekatkan dengan TTD dan menimpa bagian kiri tanda tangan secara resmi) */}
                      {stempelSekolahSetting?.value && (
                        <img 
                          src={stempelSekolahSetting.value} 
                          alt="Stempel" 
                          className="absolute left-1 top-0 h-11 w-11 object-contain opacity-90 pointer-events-none z-10 mix-blend-multiply" 
                        />
                      )}
                    </div>

                    <div className="font-bold underline text-slate-900 leading-tight">
                      {metadata.penandatanganKartu === 'ketua_pelaksana' 
                        ? (metadata.namaKetuaPelaksana || metadata.namaKetuaPanitia || 'Ketua Pelaksana') 
                        : metadata.namaKepalaSekolah}
                    </div>
                    <div className="text-[7.5px] text-slate-600">
                      NIP. {metadata.penandatanganKartu === 'ketua_pelaksana' 
                        ? (metadata.nipKetuaPelaksana || metadata.nipKetuaPanitia || '-') 
                        : metadata.nipKepalaSekolah}
                    </div>
                  </div>
                  <div className="text-[7.5px] italic text-slate-500 mt-1">
                    {metadata.catatanKartu || `*Selama ${metadata.singkatanUjian || 'ujian'} berlangsung, kartu harus dibawa`}
                  </div>
                </div>
              </div>

              {/* Right Box: Jadwal (Proportional, no awkward blank space) */}
              <div className="w-[49%] flex flex-col justify-between h-full">
                <div>
                  <div className="text-center mb-1">
                    <div className="text-[9.5px] font-bold uppercase">JADWAL {metadata.namaUjian}</div>
                    <div className="text-[8px] font-bold uppercase text-slate-600">TAHUN AJARAN {metadata.tahunAjaran}</div>
                  </div>

                  <table className="w-full border-collapse border border-slate-400 table-fixed">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800" style={{ height: tableHeadHeight }}>
                        <th className="border border-slate-400 px-0.5 w-[7%] text-center text-[7.5px]">NO</th>
                        <th className="border border-slate-400 px-1 w-[26%] text-left text-[7.5px]">Hari/Tanggal</th>
                        <th className="border border-slate-400 px-0.5 w-[19%] text-center text-[7.5px]">Waktu</th>
                        <th className="border border-slate-400 px-1 w-[34%] text-left text-[7.5px]">Mata Pelajaran</th>
                        <th className="border border-slate-400 px-0.5 w-[14%] text-center text-[7.5px]">Paraf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((item, sIdx) => (
                        <tr key={sIdx} className="border-b border-slate-300" style={{ height: tableRowHeight }}>
                          <td className="border border-slate-300 px-0.5 text-center font-medium" style={{ fontSize: tableFontSize }}>{item.no}</td>
                          <td className="border border-slate-300 px-1 leading-snug" style={{ fontSize: tableFontSize }}>{item.hariTanggal}</td>
                          <td className="border border-slate-300 px-0.5 text-center" style={{ fontSize: tableFontSize }}>{item.waktu}</td>
                          <td className="border border-slate-300 px-1 font-medium leading-snug" style={{ fontSize: tableFontSize }}>{item.mataPelajaran}</td>
                          <td className="border border-slate-300 px-0.5 text-center"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
