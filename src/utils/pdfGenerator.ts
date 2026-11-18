import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Room, SchoolMetadata, PdfDocType, ExamScheduleItem, Student } from '../types';
import { removeWhiteBackground } from './imageProcessing';

export const DEFAULT_JADWAL_TKA1: ExamScheduleItem[] = [
  { no: 1, hariTanggal: 'Rabu, 23 September 2026', waktu: '07.30 - 09.30', mataPelajaran: 'Materi Literasi' },
  { no: 2, hariTanggal: 'Kamis, 24 September 2026', waktu: '07.30 - 09.30', mataPelajaran: 'Materi Numerasi' }
];

export const DEFAULT_JADWAL_ASAT: ExamScheduleItem[] = [
  { no: 1, hariTanggal: 'Senin, 25 Mei 2026', waktu: '07.30 - 09.30', mataPelajaran: 'Bahasa Indonesia' },
  { no: 1, hariTanggal: 'Senin, 25 Mei 2026', waktu: '10.00 - 11.30', mataPelajaran: 'Pend. Agama & Budi Pekerti' },
  { no: 2, hariTanggal: 'Selasa, 26 Mei 2026', waktu: '07.30 - 09.30', mataPelajaran: 'Matematika' },
  { no: 2, hariTanggal: 'Selasa, 26 Mei 2026', waktu: '10.00 - 11.30', mataPelajaran: 'Pendidikan Pancasila' },
  { no: 3, hariTanggal: 'Jumat, 29 Mei 2026', waktu: '07.30 - 09.30', mataPelajaran: 'Bahasa Inggris' },
  { no: 3, hariTanggal: 'Jumat, 29 Mei 2026', waktu: '10.00 - 11.30', mataPelajaran: 'Informatika' },
  { no: 4, hariTanggal: 'Rabu, 3 Juni 2026', waktu: '07.30 - 09.30', mataPelajaran: 'I P A' },
  { no: 4, hariTanggal: 'Rabu, 3 Juni 2026', waktu: '10.00 - 11.30', mataPelajaran: 'Bahasa Jawa' },
  { no: 5, hariTanggal: 'Kamis, 4 Juni 2026', waktu: '07.30 - 09.00', mataPelajaran: 'I P S' },
  { no: 5, hariTanggal: 'Kamis, 4 Juni 2026', waktu: '09.30 - 11.00', mataPelajaran: 'Prakarya' },
  { no: 6, hariTanggal: 'Jumat, 5 Juni 2026', waktu: '07.30 - 09.00', mataPelajaran: 'P J O K' },
  { no: 6, hariTanggal: 'Jumat, 5 Juni 2026', waktu: '09.30 - 11.00', mataPelajaran: 'KKA' }
];

export const DEFAULT_METADATA: SchoolMetadata = {
  namaSekolah: 'SMP NEGERI 2 KEMRANJEN',
  kabupaten: 'PEMERINTAH KABUPATEN BANYUMAS\nDINAS PENDIDIKAN',
  alamat: 'Karangsalam ☎ 08112627753 Kemranjen Banyumas ✉ 53194',
  telepon: '08112627753',
  namaUjian: 'LATIHAN TES KEMAMPUAN AKADEMIK (TKA) 1',
  singkatanUjian: 'TKA 1',
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  tanggalUjian: '23 - 24 September 2026',
  namaKepalaSekolah: 'Budhy Susanto, S.Pd.',
  nipKepalaSekolah: '197908202005011013',
  namaKetuaPanitia: 'DEDIKASI, S.Pd.',
  nipKetuaPanitia: '19990909 200909 1 009',
  namaKetuaPelaksana: 'DEDIKASI, S.Pd.',
  nipKetuaPelaksana: '19990909 200909 1 009',
  pengawasDefault1: 'Pengawas Ruang 1',
  pengawasDefault2: 'Pengawas Ruang 2',
  tanggalCetakKartu: 'Kemranjen, 19 Agustus 2026',
  catatanKartu: '*Selama TKA 1 berlangsung, kartu harus dibawa',
  jadwalUjian: DEFAULT_JADWAL_TKA1
};

export interface PdfConfig {
  rooms: Room[];
  metadata: SchoolMetadata;
  docTypes: PdfDocType[];
  paperSize: 'A4' | 'F4';
  jadwalUjian?: ExamScheduleItem[];
  tanggalCetakKartu?: string;
  catatanKartu?: string;
  filterTingkat?: 'all' | '7' | '8' | '9';
  filterKelas?: 'all' | string;
  sortBy?: 'ruang' | 'kelas';
}

const getPaperFormat = (paperSize: 'A4' | 'F4') => {
  return paperSize === 'F4' ? [215.9, 330.2] : 'a4'; // F4 is typically 215.9 x 330.2 mm (8.5 x 13 inches)
};

const getPageWidth = (paperSize: 'A4' | 'F4', orientation: 'portrait' | 'landscape') => {
  if (orientation === 'portrait') {
    return paperSize === 'F4' ? 215.9 : 210;
  } else {
    return paperSize === 'F4' ? 330.2 : 297;
  }
};

import { db } from '../db/db';
import { defaultLogoKiri, defaultLogoKanan } from '../data/defaultLogos';

// Helpers for loading images
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image at ${src}`));
    img.src = src;
  });
};

let logoKiri: HTMLImageElement | null = null;
let logoKanan: HTMLImageElement | null = null;
let lastLogoKiriSrc: string | null = null;
let lastLogoKananSrc: string | null = null;

let ttdKepalaSekolah: HTMLImageElement | null = null;
let ttdKetuaPelaksana: HTMLImageElement | null = null;
let stempelSekolah: HTMLImageElement | null = null;
let lastTtdSrc: string | null = null;
let lastTtdKetuaSrc: string | null = null;
let lastStempelSrc: string | null = null;

const preloadLogos = async () => {
  try {
    let logoKiriSetting = await db.appSettings.get('logoKiri');
    if (!logoKiriSetting) {
      await db.appSettings.put({ key: 'logoKiri', value: defaultLogoKiri });
      logoKiriSetting = { key: 'logoKiri', value: defaultLogoKiri };
    }
    if (!logoKiri || lastLogoKiriSrc !== logoKiriSetting.value) {
      logoKiri = await loadImage(logoKiriSetting.value);
      lastLogoKiriSrc = logoKiriSetting.value;
    }
  } catch (e) {
    console.warn('Logo Kiri not found or invalid base64');
  }
  
  try {
    let logoKananSetting = await db.appSettings.get('logoKanan');
    if (!logoKananSetting) {
      await db.appSettings.put({ key: 'logoKanan', value: defaultLogoKanan });
      logoKananSetting = { key: 'logoKanan', value: defaultLogoKanan };
    }
    if (!logoKanan || lastLogoKananSrc !== logoKananSetting.value) {
      logoKanan = await loadImage(logoKananSetting.value);
      lastLogoKananSrc = logoKananSetting.value;
    }
  } catch (e) {
    console.warn('Logo Kanan not found or invalid base64');
  }

  // Preload scan tanda tangan kepala sekolah, tanda tangan ketua pelaksana & stempel sekolah with automatic background transparency
  try {
    const ttdSetting = await db.appSettings.get('ttdKepalaSekolah');
    if (ttdSetting?.value) {
      if (!ttdKepalaSekolah || lastTtdSrc !== ttdSetting.value) {
        // Automatically ensure white background is stripped to transparent PNG
        const transparentTtd = await removeWhiteBackground(ttdSetting.value);
        ttdKepalaSekolah = await loadImage(transparentTtd);
        lastTtdSrc = ttdSetting.value;
      }
    } else {
      ttdKepalaSekolah = null;
      lastTtdSrc = null;
    }
  } catch (e) {
    ttdKepalaSekolah = null;
  }

  try {
    const ttdKetuaSetting = await db.appSettings.get('ttdKetuaPelaksana');
    if (ttdKetuaSetting?.value) {
      if (!ttdKetuaPelaksana || lastTtdKetuaSrc !== ttdKetuaSetting.value) {
        const transparentTtd = await removeWhiteBackground(ttdKetuaSetting.value);
        ttdKetuaPelaksana = await loadImage(transparentTtd);
        lastTtdKetuaSrc = ttdKetuaSetting.value;
      }
    } else {
      ttdKetuaPelaksana = null;
      lastTtdKetuaSrc = null;
    }
  } catch (e) {
    ttdKetuaPelaksana = null;
  }

  try {
    const stempelSetting = await db.appSettings.get('stempelSekolah');
    if (stempelSetting?.value) {
      if (!stempelSekolah || lastStempelSrc !== stempelSetting.value) {
        // Automatically ensure white background is stripped to transparent PNG
        const transparentStempel = await removeWhiteBackground(stempelSetting.value);
        stempelSekolah = await loadImage(transparentStempel);
        lastStempelSrc = stempelSetting.value;
      }
    } else {
      stempelSekolah = null;
      lastStempelSrc = null;
    }
  } catch (e) {
    stempelSekolah = null;
  }
};

export function getProportionalLogoDimensions(
  img: HTMLImageElement | null,
  maxH: number,
  maxW: number
): { w: number; h: number } {
  if (!img) return { w: 0, h: 0 };
  const naturalW = img.naturalWidth || img.width || 1;
  const naturalH = img.naturalHeight || img.height || 1;
  const aspect = naturalW / naturalH;

  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { w, h };
}

async function addHeader(doc: jsPDF, meta: SchoolMetadata, title: string, paperSize: 'A4'|'F4', subtitle?: string, orientation: 'portrait'|'landscape' = 'portrait') {
  await preloadLogos();
  const w = getPageWidth(paperSize, orientation);

  const topY = 8.5;
  const maxLogoH = 17.5;
  const maxLogoW = 20.0;

  const dimKiri = getProportionalLogoDimensions(logoKiri, maxLogoH, maxLogoW);
  const dimKanan = getProportionalLogoDimensions(logoKanan, maxLogoH, maxLogoW);

  // Dinas Pendidikan text in Kop
  const kabLines = meta.kabupaten.split('\n');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);

  let textY = topY + 3.2;
  kabLines.forEach(line => {
    doc.text(line.trim(), w / 2, textY, { align: 'center' });
    textY += 4.0;
  });

  doc.setFontSize(13.5);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.namaSekolah, w / 2, textY, { align: 'center' });
  textY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(meta.alamat, w / 2, textY, { align: 'center' });

  // Calculate bottom of text and logos so no blank space exists before the line
  const textBottom = textY + 1.2;
  const logoKiriBottom = logoKiri ? topY + dimKiri.h : 0;
  const logoKananBottom = logoKanan ? topY + dimKanan.h : 0;
  const maxContentBottom = Math.max(textBottom, logoKiriBottom, logoKananBottom);

  // Border line positioned snuggly below the header content
  const lineY = maxContentBottom + 1.5;

  // Render logos vertically aligned so their bottom meets right above the line without empty space
  if (logoKiri && dimKiri.w > 0) {
    const logoKiriY = lineY - 1.5 - dimKiri.h;
    doc.addImage(logoKiri, 'PNG', 15, logoKiriY, dimKiri.w, dimKiri.h);
  }
  if (logoKanan && dimKanan.w > 0) {
    const logoKananY = lineY - 1.5 - dimKanan.h;
    doc.addImage(logoKanan, 'PNG', w - 15 - dimKanan.w, logoKananY, dimKanan.w, dimKanan.h);
  }

  // Double horizontal line (Kop Surat)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.0);
  doc.line(14, lineY, w - 14, lineY);
  doc.setLineWidth(0.3);
  doc.line(14, lineY + 1.2, w - 14, lineY + 1.2);

  let y = lineY + 5.5;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, w / 2, y, { align: 'center' });
  y += 4.5;

  if (subtitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(subtitle, w / 2, y, { align: 'center' });
    y += 4.2;
  }

  return y;
}

export async function generateRoomDocumentsPdf(config: PdfConfig): Promise<jsPDF> {
  await preloadLogos();
  const format = getPaperFormat(config.paperSize);
  
  // We will create one giant PDF if multiple doc types are requested,
  // but to keep it simple, we just generate based on the first docType.
  // Actually, Print All needs all docs in one file.
  // So we will initialize one doc and add pages.
  
  let doc: jsPDF | null = null;
  
  const initDoc = (orientation: 'portrait'|'landscape') => {
    if (!doc) {
      doc = new jsPDF({ orientation, unit: 'mm', format });
    } else {
      doc.addPage(format, orientation);
    }
    return doc;
  };

  for (const docType of config.docTypes) {
    for (const room of config.rooms) {
      if (docType === 'denah') {
        initDoc('landscape');
        await generateDenahPage(doc!, room, config.metadata, config.paperSize);
      } else if (docType === 'daftar_hadir') {
        initDoc('portrait');
        await generateDaftarHadirPage(doc!, room, config.metadata, config.paperSize);
      } else if (docType === 'peserta_ruang') {
        initDoc('portrait');
        await generatePesertaPerRuangPage(doc!, room, config.metadata, config.paperSize);
      } else if (docType === 'cek_kehadiran') {
        initDoc('portrait');
        await generateCekKehadiranPage(doc!, room, config.metadata, config.paperSize);
      } else if (docType === 'label_meja') {
        // label meja is a bit special, 8 per page
        // we'll handle it below
      } else if (docType === 'berita_acara') {
        initDoc('portrait');
        await generateBeritaAcaraPage(doc!, room, config.metadata, config.paperSize);
      }
    }
    if (docType === 'label_meja') {
       if (doc) { doc.addPage(format, 'portrait'); } else { doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format }); }
       await generateLabelMejaPages(
         doc!,
         config.rooms,
         config.metadata,
         config.paperSize,
         config.filterTingkat,
         config.filterKelas,
         config.sortBy
       );
    }
    if (docType === 'rekapitulasi') {
       if (doc) { doc.addPage(format, 'portrait'); } else { doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format }); }
       await generateRekapitulasiPage(doc!, config.rooms, config.metadata, config.paperSize);
    }
    if (docType === 'kartu_peserta') {
       if (doc) { doc.addPage(format, 'portrait'); } else { doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format }); }
       await generateKartuPesertaPages(
         doc!,
         config.rooms,
         config.metadata,
         config.paperSize,
         config.jadwalUjian,
         config.tanggalCetakKartu,
         config.catatanKartu,
         config.filterTingkat,
         config.filterKelas,
         config.sortBy
       );
    }
  }

  return doc!;
}

// ----------------- Page Generators -----------------

async function generateDenahPage(doc: jsPDF, room: Room, meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const w = getPageWidth(paperSize, 'landscape');
  const h = paperSize === 'F4' ? 215.9 : 210;

  const title = `DENAH TEMPAT DUDUK PESERTA ${meta.singkatanUjian.toUpperCase()}`;
  const subtitle = `TAHUN AJARAN ${meta.tahunAjaran} — ${room.nama.toUpperCase()}`;
  let currentY = await addHeader(doc, meta, title, paperSize, subtitle, 'landscape');
  currentY += 2;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  const boardW = 97;
  doc.roundedRect((w - boardW)/2, currentY, boardW, 8, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('[ PAPAN TULIS & MEJA PENGAWAS ]', w/2, currentY + 5.5, { align: 'center' });

  doc.roundedRect(15, currentY, 25, 8, 1, 1, 'FD');
  doc.setFontSize(8);
  doc.text('PINTU MASUK', 27.5, currentY + 5, { align: 'center' });

  const startY = currentY + 12;
  const deskW = Math.max(28, (w - 70) / 8); 
  const deskH = 26;
  const pairGap = 9;
  const colGap = 2;
  const rowGap = 7;
  
  // total width of desks = 4 * (deskW*2 + colGap) + 3 * pairGap
  const totalW = 4 * (deskW*2 + colGap) + 3 * pairGap;
  const startX = (w - totalW) / 2;

  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 8; col++) {
      const pairIndex = Math.floor((col - 1) / 2);
      const isRightInPair = (col % 2) === 0;
      const x = startX + (pairIndex * (deskW * 2 + colGap + pairGap)) + (isRightInPair ? (deskW + colGap) : 0);
      const y = startY + ((row - 1) * (deskH + rowGap));

      const mejaNomor = (row - 1) * 8 + col;
      const seat = room.seats.find(s => s.mejaNomor === mejaNomor);
      const student = seat?.student;

      if (student) {
        if (student.jenisKelamin === 'L') {
          doc.setFillColor(239, 246, 255); doc.setDrawColor(59, 130, 246);
        } else {
          doc.setFillColor(253, 242, 248); doc.setDrawColor(236, 72, 153);
        }
      } else {
        doc.setFillColor(248, 250, 252); doc.setDrawColor(203, 213, 225);
      }

      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, deskW, deskH, 1.5, 1.5, 'FD');

      doc.setFillColor(student?.jenisKelamin === 'L' ? 37 : 219, student?.jenisKelamin === 'L' ? 99 : 39, student?.jenisKelamin === 'L' ? 235 : 119);
      doc.roundedRect(x + 1, y + 1, 14, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(`Meja ${String(mejaNomor).padStart(2, '0')}`, x + 8, y + 4.2, { align: 'center' });

      if (student) {
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`${student.kelasAsal} (${student.jenisKelamin})`, x + deskW - 1.5, y + 4.2, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(71, 85, 105);
        doc.text(`No: ${student.nomorPeserta || '-'}`, x + 2, y + 8.2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(30, 41, 59);
        doc.text(`NISN: ${student.nisn || '-'}`, x + 2, y + 11.8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(15, 23, 42);
        const nameLines = doc.splitTextToSize(student.nama, deskW - 4);
        doc.text(nameLines[0], x + 2, y + 15.8);
        if (nameLines.length > 1) {
          doc.setFontSize(5.8);
          doc.text(nameLines[1], x + 2, y + 19.2);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.0);
        doc.setTextColor(100, 116, 139);
        doc.text(`Kelas: ${student.kelasAsal}`, x + 2, y + 23.5);
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('KOSONG', x + deskW / 2, y + deskH / 2 + 2, { align: 'center' });
      }
    }
  }

  const footY = Math.max(186, h - 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Kapasitas: ${room.kapasitas} | Terisi: ${room.stats.totalSiswa} Siswa (L: ${room.stats.lakiLaki}, P: ${room.stats.perempuan})`, 17, footY);
  
  const namaKetua = meta.namaKetuaPelaksana || meta.namaKetuaPanitia;
  const nipKetua = meta.nipKetuaPelaksana || meta.nipKetuaPanitia;

  // Signatures on Denah: Ketua Pelaksana & Kepala Sekolah (Tanda Tangan Pengawas Ruang Ditiadakan)
  const ketuaX = w - 122;
  const kepsekX = w - 62;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Ketua Pelaksana Ujian,', ketuaX, footY);
  if (ttdKetuaPelaksana) {
    try {
      const dim = getProportionalLogoDimensions(ttdKetuaPelaksana, 9.5, 24.0);
      const imgKetuaX = ketuaX + Math.max(1.0, (46 - dim.w) / 2);
      doc.addImage(ttdKetuaPelaksana, 'PNG', imgKetuaX, footY + 1.8, dim.w, dim.h);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.text(namaKetua, ketuaX, footY + 13.5);
  doc.line(ketuaX, footY + 14, ketuaX + 46, footY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`NIP. ${nipKetua}`, ketuaX, footY + 17.5);

  doc.setFontSize(8);
  doc.text('Mengetahui, Kepala Sekolah', kepsekX, footY);
  
  const denahTtdH = 9.5;
  const denahTtdW = 24.0;
  let imgKepsekX = kepsekX + 7.5;
  let imgKepsekY = footY + 1.8;
  let kDimW = 0;

  // Render Scan Tanda Tangan Kepala Sekolah
  if (ttdKepalaSekolah) {
    try {
      const kDim = getProportionalLogoDimensions(ttdKepalaSekolah, denahTtdH, denahTtdW);
      kDimW = kDim.w;
      imgKepsekX = kepsekX + (stempelSekolah ? 7.5 : Math.max(1.0, (46 - kDim.w) / 2));
      imgKepsekY = footY + 1.8 + Math.max(0, (denahTtdH - kDim.h) / 2);
      doc.addImage(ttdKepalaSekolah, 'PNG', imgKepsekX, imgKepsekY, kDim.w, kDim.h);
    } catch (e) {}
  }
  // Render Stempel Sekolah berdekatan & menimpa sebagian sisi kiri tanda tangan (overlap resmi ~35%)
  if (stempelSekolah) {
    try {
      const sDim = getProportionalLogoDimensions(stempelSekolah, 11.5, 13.0);
      let stempelX: number;
      if (ttdKepalaSekolah && kDimW > 0) {
        stempelX = imgKepsekX - (sDim.w * 0.62);
      } else {
        stempelX = kepsekX + 1.5;
      }
      stempelX = Math.max(kepsekX - 0.5, stempelX);
      doc.addImage(stempelSekolah, 'PNG', stempelX, footY + 1.2, sDim.w, sDim.h);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.text(meta.namaKepalaSekolah, kepsekX, footY + 13.5);
  doc.line(kepsekX, footY + 14, kepsekX + 46, footY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`NIP. ${meta.nipKepalaSekolah}`, kepsekX, footY + 17.5);
}

async function generateDaftarHadirPage(doc: jsPDF, room: Room, meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const startY = await addHeader(doc, meta, 'DAFTAR HADIR PESERTA UJIAN', paperSize, `${meta.namaUjian.toUpperCase()} TAHUN AJARAN ${meta.tahunAjaran}`);
  const w = getPageWidth(paperSize, 'portrait');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.text(`Ruang`, 14, startY + 2);
  doc.text(`: ${room.nama}`, 32, startY + 2);
  doc.text(`Mata Pelajaran`, 14, startY + 6.5);
  doc.text(`: .......................................`, 32, startY + 6.5);

  doc.text(`Hari / Tanggal`, w - 95, startY + 2);
  doc.text(`: .......................................`, w - 70, startY + 2);
  doc.text(`Waktu / Sesi`, w - 95, startY + 6.5);
  doc.text(`: .......................................`, w - 70, startY + 6.5);

  const studentsInRoom = room.seats.map(s => s.student).filter((s): s is NonNullable<typeof s> => s !== null);
  const tableRows = studentsInRoom.map((s, idx) => {
    const isOdd = (idx + 1) % 2 === 1;
    return [
      (idx + 1).toString(), s.nomorPeserta || s.nisn, s.nama, s.kelasAsal, s.jenisKelamin,
      isOdd ? `${idx + 1}. .........` : '', !isOdd ? `${idx + 1}. .........` : '', ''
    ];
  });

  autoTable(doc, {
    startY: startY + 10,
    head: [
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'No. Peserta', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Nama Lengkap Siswa', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'Kelas', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'L/P', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Tanda Tangan', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Ket.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [{ content: 'Ganjil', styles: { halign: 'center' } }, { content: 'Genap', styles: { halign: 'center' } }]
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8, lineWidth: 0.2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.5, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 62 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 26 },
      6: { cellWidth: 26 },
      7: { cellWidth: 14 }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8.5);
  doc.text(`............................., ............................. 20....`, w - 70, finalY);
  doc.text(`Pengawas Ruang I,`, 20, finalY + 4.5);
  doc.text(`Pengawas Ruang II / Guru Mapel,`, w - 70, finalY + 4.5);
  doc.line(20, finalY + 20, 70, finalY + 20);
  doc.line(w - 70, finalY + 20, w - 20, finalY + 20);
  doc.setFontSize(7.5);
  doc.text(`NIP. .........................................`, 20, finalY + 24);
  doc.text(`NIP. .........................................`, w - 70, finalY + 24);
}

async function generatePesertaPerRuangPage(doc: jsPDF, room: Room, meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const startY = await addHeader(doc, meta, 'DAFTAR PESERTA PER RUANG UJIAN', paperSize, `${meta.namaUjian.toUpperCase()} — ${room.nama.toUpperCase()}`);
  const w = getPageWidth(paperSize, 'portrait');

  const studentsInRoom = room.seats.map(s => s.student).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => a.nama.localeCompare(b.nama));
  const rows = studentsInRoom.map((s, idx) => [
    (idx + 1).toString(), s.nomorPeserta || s.nisn, s.nama, s.kelasAsal, s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head: [['No', 'No. Peserta', 'Nama Peserta', 'Kelas', 'Jenis Kelamin']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 28, halign: 'center' }, 2: { cellWidth: 76 }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 30, halign: 'center' } },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const namaKetua = meta.namaKetuaPelaksana || meta.namaKetuaPanitia;
  const nipKetua = meta.nipKetuaPelaksana || meta.nipKetuaPanitia;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ketua Pelaksana Ujian,`, 20, finalY);
  if (ttdKetuaPelaksana) {
    try {
      const dim = getProportionalLogoDimensions(ttdKetuaPelaksana, 10.5, 26.0);
      const imgKetuaX = 20 + Math.max(1.5, (55 - dim.w) / 2);
      const imgKetuaY = finalY + 2.2 + Math.max(0, (10.5 - dim.h) / 2);
      doc.addImage(ttdKetuaPelaksana, 'PNG', imgKetuaX, imgKetuaY, dim.w, dim.h);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.text(namaKetua, 20, finalY + 16);
  doc.line(20, finalY + 16.5, 75, finalY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${nipKetua}`, 20, finalY + 20.5);

  const kepsekX = w - 75;
  const blockW = 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Mengetahui, Kepala Sekolah`, kepsekX, finalY);

  const maxTtdH = 11.0;
  const maxTtdW = 28.0;
  const maxStempelH = 13.0;
  const maxStempelW = 14.0;

  let imgKepsekX = kepsekX + 11.0;
  let imgKepsekY = finalY + 2.4;
  let kDimW = 0;

  // Render Tanda Tangan Kepala Sekolah (presisi proporsional)
  if (ttdKepalaSekolah) {
    try {
      const kDim = getProportionalLogoDimensions(ttdKepalaSekolah, maxTtdH, maxTtdW);
      kDimW = kDim.w;
      imgKepsekX = kepsekX + (stempelSekolah ? 9.5 : Math.max(2.0, (blockW - kDim.w) / 2));
      imgKepsekY = finalY + 2.2 + Math.max(0, (maxTtdH - kDim.h) / 2);
      doc.addImage(ttdKepalaSekolah, 'PNG', imgKepsekX, imgKepsekY, kDim.w, kDim.h);
    } catch (e) {}
  }

  // Render Stempel Sekolah: presisi di sisi kiri TTD & overlap resmi 30-40%
  if (stempelSekolah) {
    try {
      const sDim = getProportionalLogoDimensions(stempelSekolah, maxStempelH, maxStempelW);
      let stempelX: number;
      if (ttdKepalaSekolah && kDimW > 0) {
        stempelX = imgKepsekX - (sDim.w * 0.62);
      } else {
        stempelX = kepsekX + 2.0;
      }
      stempelX = Math.max(kepsekX - 0.5, stempelX);
      const stempelY = finalY + 1.8;
      doc.addImage(stempelSekolah, 'PNG', stempelX, stempelY, sDim.w, sDim.h);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.text(meta.namaKepalaSekolah, kepsekX, finalY + 16);
  doc.line(kepsekX, finalY + 16.5, kepsekX + blockW, finalY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${meta.nipKepalaSekolah}`, kepsekX, finalY + 20.5);
}

async function generateCekKehadiranPage(doc: jsPDF, room: Room, meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const w = getPageWidth(paperSize, 'portrait');
  
  const title = `DAFTAR CEK KEHADIRAN PESERTA ${meta.singkatanUjian.toUpperCase()}`;
  const subtitle = `TAHUN AJARAN ${meta.tahunAjaran} — ${room.nama.toUpperCase()}`;
  const startY = await addHeader(doc, meta, title, paperSize, subtitle, 'portrait');

  const studentsInRoom = room.seats.map(s => s.student).filter((s): s is NonNullable<typeof s> => s !== null);

  // Informasi Ruang & Jadwal (Presisi Kiri-Kanan)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  doc.text('Ruang', 14, startY + 2.5);
  doc.text(`: ${room.nama}`, 35, startY + 2.5);
  doc.text('Jumlah Peserta', 14, startY + 7);
  doc.text(`: ${studentsInRoom.length} Orang`, 35, startY + 7);

  doc.text('Hari / Tanggal', w - 90, startY + 2.5);
  doc.text(`: ${meta.tanggalUjian || '...........................'}`, w - 65, startY + 2.5);
  doc.text('Tahun Ajaran', w - 90, startY + 7);
  doc.text(`: ${meta.tahunAjaran}`, w - 65, startY + 7);

  // 2 Kolom Mata Pelajaran: Literasi & Numerasi (dapat disesuaikan dari metadata jika tersedia)
  const mapelList = (meta.cekKehadiranMapel && meta.cekKehadiranMapel.length === 2) 
    ? meta.cekKehadiranMapel 
    : ['Literasi', 'Numerasi'];

  const tableRows = studentsInRoom.map((s, idx) => [
    (idx + 1).toString(),
    s.nomorPeserta || s.nisn,
    s.nama,
    s.kelasAsal,
    '', // Kolom 1: Literasi
    '', // Kolom 2: Numerasi
    ''  // Keterangan
  ]);

  autoTable(doc, {
    startY: startY + 10.5,
    head: [
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'No. Peserta', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Nama Lengkap Peserta', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'Kelas', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Mata Pelajaran Ujian', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Ket.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: mapelList[0], styles: { halign: 'center', valign: 'middle' } },
        { content: mapelList[1], styles: { halign: 'center', valign: 'middle' } }
      ]
    ],
    body: tableRows,
    foot: [
      [
        { content: 'Jumlah Peserta Hadir', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '....... orang', styles: { halign: 'center', fontSize: 7 } },
        { content: '....... orang', styles: { halign: 'center', fontSize: 7 } },
        { content: '', styles: { halign: 'center' } }
      ],
      [
        { content: 'Jumlah Peserta Tidak Hadir', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '....... orang', styles: { halign: 'center', fontSize: 7 } },
        { content: '....... orang', styles: { halign: 'center', fontSize: 7 } },
        { content: '', styles: { halign: 'center' } }
      ]
    ],
    theme: 'grid',
    headStyles: { 
      fillColor: [241, 245, 249], 
      textColor: [15, 23, 42], 
      fontStyle: 'bold', 
      fontSize: 8, 
      lineWidth: 0.2 
    },
    bodyStyles: { 
      fontSize: 7.5, 
      cellPadding: 1.8, 
      lineWidth: 0.2, 
      textColor: [15, 23, 42] 
    },
    footStyles: { 
      fillColor: [248, 250, 252], 
      textColor: [15, 23, 42], 
      fontSize: 7.5, 
      fontStyle: 'bold', 
      lineWidth: 0.2 
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, halign: 'center' },
      2: { halign: 'left' }, // Mengisi sisa lebar horizontal secara presisi matematis
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 32, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 4;

  // Catatan / Petunjuk Teknis Kehadiran
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('* Petunjuk: Beri tanda centang (✓) atau paraf pada kolom kehadiran. Tulis (S) Sakit, (I) Izin, (A) Alpa jika peserta tidak hadir.', 14, finalY);

  const sigY = finalY + 5.5;
  const colW = 86;
  const leftX = 14;
  const rightX = w - 14 - colW;

  const mapel1 = mapelList[0] || 'Literasi';
  const mapel2 = mapelList[1] || 'Numerasi';

  // ==========================================
  // KOLOM KIRI: PENGAWAS RUANG HARI PERTAMA
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Pengawas Ruang — Hari Pertama (${mapel1})`, leftX, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Hari / Tgl : ..............................................................`, leftX, sigY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Pengawas Ruang :`, leftX, sigY + 11);
  doc.text(`Nama : .....................................................................`, leftX + 4, sigY + 16.5);
  doc.text(`NIP    : .....................................................................`, leftX + 4, sigY + 22);
  doc.text(`TTD   : ( ............................................................... )`, leftX + 4, sigY + 28.5);

  // ==========================================
  // KOLOM KANAN: PENGAWAS RUANG HARI KEDUA
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Pengawas Ruang — Hari Kedua (${mapel2})`, rightX, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Hari / Tgl : ..............................................................`, rightX, sigY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Pengawas Ruang :`, rightX, sigY + 11);
  doc.text(`Nama : .....................................................................`, rightX + 4, sigY + 16.5);
  doc.text(`NIP    : .....................................................................`, rightX + 4, sigY + 22);
  doc.text(`TTD   : ( ............................................................... )`, rightX + 4, sigY + 28.5);
}

async function generateLabelMejaPages(
  doc: jsPDF,
  rooms: Room[],
  meta: SchoolMetadata,
  paperSize: 'A4'|'F4',
  filterTingkat?: 'all' | '7' | '8' | '9',
  filterKelas?: 'all' | string,
  sortBy?: 'ruang' | 'kelas'
) {
  let allSeats: Array<{ roomName: string; roomId: number; seat: any }> = [];
  rooms.forEach(r => {
    const sortedSeats = [...r.seats].sort((a, b) => a.mejaNomor - b.mejaNomor);
    sortedSeats.forEach(s => {
      if (s.student) {
        if (filterTingkat && filterTingkat !== 'all') {
          if (String(s.student.jenjang) !== filterTingkat) return;
        }
        if (filterKelas && filterKelas !== 'all') {
          if (s.student.kelasAsal !== filterKelas) return;
        }
        allSeats.push({ roomName: r.nama, roomId: r.id, seat: s });
      }
    });
  });

  if (sortBy === 'kelas') {
    allSeats.sort((a, b) => {
      const cmpKelas = (a.seat.student.kelasAsal || '').localeCompare(b.seat.student.kelasAsal || '', undefined, { numeric: true });
      if (cmpKelas !== 0) return cmpKelas;
      return (a.seat.student.nomorPeserta || a.seat.student.nama).localeCompare(b.seat.student.nomorPeserta || b.seat.student.nama, undefined, { numeric: true });
    });
  }

  if (allSeats.length === 0) return;

  const w = getPageWidth(paperSize, 'portrait');
  const cardW = 88;
  const cardH = 62;
  const gapX = 6;
  const gapY = paperSize === 'F4' ? 8 : 6;
  const startX = (w - (2 * cardW + gapX)) / 2;
  const startY = paperSize === 'F4' ? 12 : 10;
  const format = getPaperFormat(paperSize);

  let p = 0;
  allSeats.forEach((item, idx) => {
    const pageIndex = Math.floor(idx / 8);
    const itemInPage = idx % 8;

    if (itemInPage === 0 && pageIndex > 0 && pageIndex > p) {
      doc.addPage(format, 'portrait');
      p = pageIndex;
    }

    const col = itemInPage % 2;
    const row = Math.floor(itemInPage / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const s = item.seat.student;

    // Card boundary
    doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    // Header banner
    doc.setFillColor(30, 41, 59); doc.roundedRect(x, y, cardW, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text(meta.namaSekolah, x + cardW / 2, y + 4.2, { align: 'center' });
    doc.setFontSize(6.2);
    doc.text(`LABEL MEJA PESERTA ${meta.singkatanUjian || meta.namaUjian} (${meta.tahunAjaran})`, x + cardW / 2, y + 8.2, { align: 'center' });

    // Sub-bar: Room & Meja Badge on left, barcode simulation on right
    doc.setFillColor(241, 245, 249); doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x + 3, y + 11.8, 44, 5.2, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(15, 23, 42);
    doc.text(`${item.roomName.toUpperCase()} — MEJA ${String(item.seat.mejaNomor).padStart(2, '0')}`, x + 25, y + 15.6, { align: 'center' });

    doc.setFont('courier', 'bold'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105);
    doc.text(`|||| || ||| ||||| ||`, x + cardW - 3.5, y + 15.6, { align: 'right' });

    // Student Information
    let infoY = y + 20.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105);
    doc.text('Nama Siswa', x + 3.5, infoY);
    doc.text(':', x + 18, infoY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(15, 23, 42);
    const splitName = doc.splitTextToSize(s.nama, 65);
    doc.text(splitName[0], x + 20, infoY);
    if (splitName.length > 1) {
      infoY += 2.8;
      doc.text(splitName[1], x + 20, infoY);
    }

    infoY += 3.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105);
    doc.text('NISN', x + 3.5, infoY);
    doc.text(':', x + 18, infoY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(15, 23, 42);
    doc.text(s.nisn || '-', x + 20, infoY);

    // No. Peserta
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105);
    doc.text('No. Peserta', x + 46, infoY);
    doc.text(':', x + 59, infoY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(15, 23, 42);
    doc.text(s.nomorPeserta || '-', x + 61, infoY);

    infoY += 3.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105);
    doc.text('Kelas Asal', x + 3.5, infoY);
    doc.text(':', x + 18, infoY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(15, 23, 42);
    doc.text(`${s.kelasAsal} (${s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'})`, x + 20, infoY);

    // Subtle divider
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
    doc.line(x + 3.5, y + 33.2, x + cardW - 3.5, y + 33.2);

    // Bottom section:
    // Left: Instruksi penempelan label meja
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8); doc.setTextColor(100, 116, 139);
    doc.text('* Tempelkan pada sudut kanan', x + 3.5, y + 38.5);
    doc.text('  atas meja ujian peserta.', x + 3.5, y + 41.5);
    doc.setFontSize(4.2); doc.setTextColor(148, 163, 184);
    doc.text('Label Meja Resmi Peserta Ujian', x + 3.5, y + 46.0);

    // Right: Tanda Tangan & Stempel Kepala Sekolah
    const ttdX = x + 47;
    const ttdY = y + 35.0;

    const tanggalCetak = meta.tanggalCetakKartu || meta.tanggalUjian || 'Agustus 2026';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.setTextColor(15, 23, 42);
    doc.text(tanggalCetak, ttdX, ttdY);
    doc.text('Kepala Sekolah,', ttdX, ttdY + 2.8);

    // Scan Tanda Tangan Kepala Sekolah
    if (ttdKepalaSekolah) {
      try {
        const ttdDim = getProportionalLogoDimensions(ttdKepalaSekolah, 7.5, 18.0);
        const imgTtdX = ttdX + 4.5;
        const imgTtdY = ttdY + 2.3;
        doc.addImage(ttdKepalaSekolah, 'PNG', imgTtdX, imgTtdY, ttdDim.w, ttdDim.h);
      } catch (e) {}
    }

    // Scan Stempel Sekolah (overlap dengan TTD)
    if (stempelSekolah) {
      try {
        const stempelDim = getProportionalLogoDimensions(stempelSekolah, 9.8, 11.5);
        const stempelX = ttdX - 1.5;
        const stempelY = ttdY + 2.0;
        doc.addImage(stempelSekolah, 'PNG', stempelX, stempelY, stempelDim.w, stempelDim.h);
      } catch (e) {}
    }

    // Nama Kepala Sekolah
    const namaY = ttdY + 12.5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.setTextColor(15, 23, 42);
    doc.text(meta.namaKepalaSekolah, ttdX, namaY);
    doc.setLineWidth(0.2);
    const namaW = Math.max(doc.getTextWidth(meta.namaKepalaSekolah), 28);
    doc.line(ttdX, namaY + 0.4, ttdX + namaW, namaY + 0.4);

    // NIP
    doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8);
    doc.text(`NIP. ${meta.nipKepalaSekolah}`, ttdX, namaY + 3.2);
  });
}

async function generateBeritaAcaraPage(doc: jsPDF, room: Room, meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const startY = await addHeader(doc, meta, 'BERITA ACARA PELAKSANAAN UJIAN', paperSize, `${meta.namaUjian.toUpperCase()} TAHUN AJARAN ${meta.tahunAjaran}`);
  const w = getPageWidth(paperSize, 'portrait');

  let y = startY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  const introText = `Pada hari ini ......................... tanggal ........... bulan ........................ tahun ${meta.tahunAjaran.split('/')[0] || '20..'}, telah diselenggarakan ${meta.namaUjian} untuk:`;
  const introLines = doc.splitTextToSize(introText, w - 28);
  doc.text(introLines, 14, y);
  y += introLines.length * 5 + 3;

  const fieldPairs = [
    ['Satuan Pendidikan', `: ${meta.namaSekolah}`],
    ['Ruang Ujian', `: ${room.nama}`],
    ['Mata Pelajaran', `: ............................................................................`],
    ['Waktu / Sesi', `: Pukul ............ s.d. ............ WIB (Sesi: ......)`],
    ['Jumlah Peserta Terdaftar', `: ${room.stats.totalSiswa} Orang (L: ${room.stats.lakiLaki}, P: ${room.stats.perempuan})`],
    ['Jumlah Peserta Hadir', `: ........... Orang`],
    ['Jumlah Peserta Tidak Hadir', `: ........... Orang (NISN: .......................................)`]
  ];

  fieldPairs.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 75, y);
    y += 5.5;
  });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan Selama Pelaksanaan Ujian:', 14, y);
  y += 5;

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, w - 28, 35, 1, 1);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('(Catat jika terdapat naskah rusak, peserta terlambat, pengawas pengganti, dll. Kosongkan jika lancar dan tertib)', 18, y + 6);

  y += 45;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('Demikian Berita Acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.', 14, y);

  y += 10;
  doc.text('Pengawas Ruang I,', 25, y);
  doc.text('Pengawas Ruang II,', w - 70, y);

  doc.line(25, y + 20, 80, y + 20);
  doc.line(w - 70, y + 20, w - 15, y + 20);

  doc.setFontSize(8);
  doc.text('NIP. ........................................', 25, y + 24);
  doc.text('NIP. ........................................', w - 70, y + 24);
}

async function generateRekapitulasiPage(doc: jsPDF, rooms: Room[], meta: SchoolMetadata, paperSize: 'A4'|'F4') {
  const startY = await addHeader(doc, meta, 'REKAPITULASI PEMBAGIAN RUANG TES', paperSize, `${meta.namaUjian.toUpperCase()} TAHUN AJARAN ${meta.tahunAjaran}`);
  const w = getPageWidth(paperSize, 'portrait');

  const classMap: Record<string, Record<string, number>> = {};
  const allClasses = new Set<string>();

  rooms.forEach(r => {
    r.seats.forEach(s => {
      if (s.student) {
        const c = s.student.kelasAsal;
        allClasses.add(c);
        if (!classMap[c]) classMap[c] = {};
        classMap[c][r.nama] = (classMap[c][r.nama] || 0) + 1;
      }
    });
  });

  const sortedClasses = Array.from(allClasses).sort((a, b) => a.localeCompare(b));
  const headCols = ['No', 'Kelas', ...rooms.map(r => String(r.id)), 'Jumlah'];
  const bodyRows: any[] = [];
  let grandTotal = 0;
  const roomTotals: number[] = new Array(rooms.length).fill(0);

  sortedClasses.forEach((cls, idx) => {
    let rowSum = 0;
    const row = [
      (idx + 1).toString(),
      cls,
      ...rooms.map((r, rIdx) => {
        const count = classMap[cls]?.[r.nama] || 0;
        rowSum += count;
        roomTotals[rIdx] += count;
        return count > 0 ? count.toString() : '-';
      }),
      rowSum.toString()
    ];
    grandTotal += rowSum;
    bodyRows.push(row);
  });

  bodyRows.push([
    { content: 'TOTAL SISWA', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
    ...roomTotals.map(t => ({ content: t.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } })),
    { content: grandTotal.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } }
  ]);

  autoTable(doc, {
    startY: startY + 6,
    head: [headCols],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, halign: 'center', cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 18, halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const namaKetua = meta.namaKetuaPelaksana || meta.namaKetuaPanitia;
  const nipKetua = meta.nipKetuaPelaksana || meta.nipKetuaPanitia;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ketua Pelaksana Ujian,`, 20, finalY);
  if (ttdKetuaPelaksana) {
    try {
      const dim = getProportionalLogoDimensions(ttdKetuaPelaksana, 10.5, 26.0);
      const imgKetuaX = 20 + Math.max(1.5, (55 - dim.w) / 2);
      const imgKetuaY = finalY + 2.2 + Math.max(0, (10.5 - dim.h) / 2);
      doc.addImage(ttdKetuaPelaksana, 'PNG', imgKetuaX, imgKetuaY, dim.w, dim.h);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.text(namaKetua, 20, finalY + 16);
  doc.line(20, finalY + 16.5, 75, finalY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${nipKetua}`, 20, finalY + 20.5);

  const kepsekX = w - 75;
  const blockW = 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Mengetahui, Kepala Sekolah`, kepsekX, finalY);

  const maxTtdH = 11.0;
  const maxTtdW = 28.0;
  const maxStempelH = 13.0;
  const maxStempelW = 14.0;

  let imgKepsekX = kepsekX + 11.0;
  let imgKepsekY = finalY + 2.4;
  let kDimW = 0;

  if (ttdKepalaSekolah) {
    try {
      const kDim = getProportionalLogoDimensions(ttdKepalaSekolah, maxTtdH, maxTtdW);
      kDimW = kDim.w;
      imgKepsekX = kepsekX + (stempelSekolah ? 9.5 : Math.max(2.0, (blockW - kDim.w) / 2));
      imgKepsekY = finalY + 2.2 + Math.max(0, (maxTtdH - kDim.h) / 2);
      doc.addImage(ttdKepalaSekolah, 'PNG', imgKepsekX, imgKepsekY, kDim.w, kDim.h);
    } catch (e) {}
  }

  if (stempelSekolah) {
    try {
      const sDim = getProportionalLogoDimensions(stempelSekolah, maxStempelH, maxStempelW);
      let stempelX: number;
      if (ttdKepalaSekolah && kDimW > 0) {
        stempelX = imgKepsekX - (sDim.w * 0.62);
      } else {
        stempelX = kepsekX + 2.0;
      }
      stempelX = Math.max(kepsekX - 0.5, stempelX);
      const stempelY = finalY + 1.8;
      doc.addImage(stempelSekolah, 'PNG', stempelX, stempelY, sDim.w, sDim.h);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.text(meta.namaKepalaSekolah, kepsekX, finalY + 16);
  doc.line(kepsekX, finalY + 16.5, kepsekX + blockW, finalY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`NIP. ${meta.nipKepalaSekolah}`, kepsekX, finalY + 20.5);
}

export async function generateKartuPesertaPages(
  doc: jsPDF,
  rooms: Room[],
  meta: SchoolMetadata,
  paperSize: 'A4' | 'F4',
  customSchedule?: ExamScheduleItem[],
  customTanggalCetak?: string,
  customCatatan?: string,
  filterTingkat?: 'all' | '7' | '8' | '9',
  filterKelas?: 'all' | string,
  sortBy?: 'ruang' | 'kelas'
) {
  interface StudentCardItem {
    roomName: string;
    roomId: number;
    mejaNomor: number;
    student: Student;
  }

  let allCards: StudentCardItem[] = [];
  rooms.forEach(r => {
    // Sort seats by mejaNomor so cards are in seat order per room
    const sortedSeats = [...r.seats].sort((a, b) => a.mejaNomor - b.mejaNomor);
    sortedSeats.forEach(s => {
      if (s.student) {
        // Filter tingkat / jenjang
        if (filterTingkat && filterTingkat !== 'all') {
          if (String(s.student.jenjang) !== filterTingkat) return;
        }
        // Filter kelas
        if (filterKelas && filterKelas !== 'all') {
          if (s.student.kelasAsal !== filterKelas) return;
        }

        allCards.push({
          roomName: r.nama,
          roomId: r.id,
          mejaNomor: s.mejaNomor,
          student: s.student
        });
      }
    });
  });

  // Sort by class or room
  if (sortBy === 'kelas') {
    allCards.sort((a, b) => {
      const cmpKelas = (a.student.kelasAsal || '').localeCompare(b.student.kelasAsal || '', undefined, { numeric: true });
      if (cmpKelas !== 0) return cmpKelas;
      return (a.student.nomorPeserta || a.student.nama).localeCompare(b.student.nomorPeserta || b.student.nama, undefined, { numeric: true });
    });
  }

  if (allCards.length === 0) return;

  const w = getPageWidth(paperSize, 'portrait');
  const cardW = paperSize === 'F4' ? 196 : 194;
  // 4 cards per page
  const cardH = paperSize === 'F4' ? 75 : 68;
  const gapY = paperSize === 'F4' ? 3.8 : 3.2;
  const startX = (w - cardW) / 2;
  const startY = paperSize === 'F4' ? 8 : 6.5;
  const format = getPaperFormat(paperSize);

  // Prepare Schedule Rows
  const scheduleRows = (customSchedule && customSchedule.length > 0)
    ? customSchedule.map(item => [
        String(item.no),
        item.hariTanggal,
        item.waktu,
        item.mataPelajaran,
        ''
      ])
    : (meta.jadwalUjian && meta.jadwalUjian.length > 0)
    ? meta.jadwalUjian.map(item => [
        String(item.no),
        item.hariTanggal,
        item.waktu,
        item.mataPelajaran,
        ''
      ])
    : DEFAULT_JADWAL_TKA1.map(item => [
        String(item.no),
        item.hariTanggal,
        item.waktu,
        item.mataPelajaran,
        ''
      ]);

  const rowCount = scheduleRows.length;
  // Calculate proportional height to systematically fill the card without large bottom gap
  const availableTableH = cardH - 7.0 - 2.5;
  const totalUnits = 1.0 + rowCount;
  const idealUnitH = availableTableH / totalUnits;

  // Proportional row heights
  const targetBodyRowH = Math.min(Math.max(idealUnitH, 3.6), 22.0);
  const targetHeadRowH = Math.min(Math.max(idealUnitH * 0.9, 4.0), 8.5);

  let tableFontSize = 5.0;
  let tableCellPadding = 0.65;
  if (rowCount <= 2) {
    tableFontSize = 6.6;
    tableCellPadding = 1.6;
  } else if (rowCount <= 4) {
    tableFontSize = 5.8;
    tableCellPadding = 1.2;
  } else if (rowCount <= 6) {
    tableFontSize = 5.2;
    tableCellPadding = 0.85;
  } else if (rowCount <= 9) {
    tableFontSize = 4.6;
    tableCellPadding = 0.55;
  } else {
    tableFontSize = 4.2;
    tableCellPadding = 0.35;
  }

  let currentPage = 0;

  allCards.forEach((item, idx) => {
    // Exactly 4 cards per page
    const pageIndex = Math.floor(idx / 4);
    const itemInPage = idx % 4;

    if (itemInPage === 0 && pageIndex > 0 && pageIndex > currentPage) {
      doc.addPage(format, 'portrait');
      currentPage = pageIndex;
    }

    const y = startY + itemInPage * (cardH + gapY);
    const s = item.student;

    // 1. Outer Card Box
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.rect(startX, y, cardW, cardH, 'FD');

    // Cutting guide line between cards (if not the 4th card on the page)
    if (itemInPage < 3) {
      const cutY = y + cardH + (gapY / 2);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(startX - 2, cutY, startX + cardW + 2, cutY);
      doc.setLineDashPattern([], 0);
    }

    // 2. Vertical Divider
    const leftW = 97;
    const rightW = cardW - leftW;
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.25);
    doc.line(startX + leftW, y, startX + leftW, y + cardH);

    // ---------------- LEFT HALF: IDENTITAS & KOP & TTD ----------------
    const miniTopY = y + 1.6;
    const miniMaxH = 9.2;
    const miniMaxW = 10.5;
    const miniDimKiri = getProportionalLogoDimensions(logoKiri, miniMaxH, miniMaxW);

    // Mini Kop Text
    const kopCenterX = (logoKiri && miniDimKiri.w > 0) ? startX + 53 : startX + (leftW / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);

    const kabLines = meta.kabupaten.split('\n');
    let kopY = miniTopY + 2.0;
    kabLines.forEach(line => {
      doc.text(line.trim(), kopCenterX, kopY, { align: 'center' });
      kopY += 2.4;
    });

    doc.setFontSize(6.8);
    doc.text(meta.namaSekolah, kopCenterX, kopY, { align: 'center' });
    kopY += 2.4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.3);
    doc.setTextColor(71, 85, 105);
    doc.text(meta.alamat, kopCenterX, kopY, { align: 'center' });

    // Double Horizontal Line Kop - snug without blank space
    const miniContentBottom = Math.max(kopY + 0.6, miniTopY + miniDimKiri.h);
    const lineY = miniContentBottom + 1.0;

    if (logoKiri && miniDimKiri.w > 0) {
      try {
        const miniLogoY = lineY - 1.0 - miniDimKiri.h;
        doc.addImage(logoKiri, 'PNG', startX + 2.5, miniLogoY, miniDimKiri.w, miniDimKiri.h);
      } catch (e) {
        // Fallback silently
      }
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.45);
    doc.line(startX + 2, lineY, startX + leftW - 2, lineY);
    doc.setLineWidth(0.15);
    doc.line(startX + 2, lineY + 0.5, startX + leftW - 2, lineY + 0.5);

    // Title
    const titleCenter = startX + (leftW / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('KARTU PESERTA', titleCenter, lineY + 3.0, { align: 'center' });

    doc.setFontSize(5.6);
    doc.text(meta.namaUjian.toUpperCase(), titleCenter, lineY + 5.5, { align: 'center' });

    doc.setFontSize(5.0);
    doc.text(`TAHUN AJARAN ${meta.tahunAjaran}`, titleCenter, lineY + 7.8, { align: 'center' });

    // Student Info (Compact spacing, NISN directly below Nama)
    let infoY = lineY + 11.0;
    const labelX = startX + 2.5;
    const colonX = startX + 17.5;
    const valX = startX + 19.5;
    const rowH = 3.0;

    // 1. Nama
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    doc.text('Nama', labelX, infoY);
    doc.text(':', colonX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const splitNama = doc.splitTextToSize(s.nama, leftW - 22);
    doc.text(splitNama[0], valX, infoY);
    if (splitNama.length > 1) {
      infoY += 2.6;
      doc.text(splitNama[1], valX, infoY);
    }

    // 2. NISN (Di bawah Nama sesuai permintaan)
    infoY += rowH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('NISN', labelX, infoY);
    doc.text(':', colonX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(s.nisn || '-', valX, infoY);

    // 3. Nomor Tes
    infoY += rowH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Nomor Tes', labelX, infoY);
    doc.text(':', colonX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(s.nomorPeserta || s.nisn, valX, infoY);

    // 4. Kelas
    infoY += rowH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Kelas', labelX, infoY);
    doc.text(':', colonX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(s.kelasAsal, valX, infoY);

    // 5. Ruang
    infoY += rowH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Ruang', labelX, infoY);
    doc.text(':', colonX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const ruangDisplay = item.roomName.replace(/Ruang\s*/i, '') || String(item.roomId);
    doc.text(ruangDisplay, valX, infoY);

    // Tanda Tangan & Stempel Kepala Sekolah (Diataskan, space kosong dikurangi)
    const ttdX = startX + 53;
    const ttdY = y + cardH - (paperSize === 'F4' ? 22.0 : 20.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(15, 23, 42);
    const tanggalCetak = customTanggalCetak || meta.tanggalCetakKartu || 'Kemranjen, 19 Agustus 2026';
    doc.text(tanggalCetak, ttdX, ttdY);

    const isKetuaPelaksana = meta.penandatanganKartu === 'ketua_pelaksana';
    const signerTitle = isKetuaPelaksana ? 'Ketua Pelaksana Ujian,' : 'Kepala Sekolah,';
    const signerName = isKetuaPelaksana ? (meta.namaKetuaPelaksana || meta.namaKetuaPanitia || 'Ketua Pelaksana') : meta.namaKepalaSekolah;
    const signerNip = isKetuaPelaksana ? (meta.nipKetuaPelaksana || meta.nipKetuaPanitia || '-') : meta.nipKepalaSekolah;
    const signerTtd = isKetuaPelaksana ? ttdKetuaPelaksana : ttdKepalaSekolah;

    doc.text(signerTitle, ttdX, ttdY + 2.7);

    // Render Scan Tanda Tangan (presisi di antara jabatan dan nama terang)
    if (signerTtd) {
      try {
        const ttdDim = getProportionalLogoDimensions(signerTtd, 8.8, 20.0);
        const imgTtdX = ttdX + 2.5;
        const imgTtdY = ttdY + 2.4;
        doc.addImage(signerTtd, 'PNG', imgTtdX, imgTtdY, ttdDim.w, ttdDim.h);
      } catch (e) {
        // Fallback silently
      }
    }

    // Render Stempel Sekolah didekatkan dengan tanda tangan (posisi presisi & overlap resmi ~40%)
    if (stempelSekolah) {
      try {
        const stempelDim = getProportionalLogoDimensions(stempelSekolah, 11.5, 13.5);
        // Stempel didekatkan ke TTD: koordinat X berdekatan dan menimpa bagian kiri tanda tangan
        const stempelX = ttdX - 2.0;
        const stempelY = ttdY + 1.8;
        doc.addImage(stempelSekolah, 'PNG', stempelX, stempelY, stempelDim.w, stempelDim.h);
      } catch (e) {
        // Fallback silently
      }
    }

    // Nama Penandatangan
    const namaY = ttdY + 11.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.text(signerName, ttdX, namaY);
    doc.setLineWidth(0.2);
    const ttdWidth = Math.max(doc.getTextWidth(signerName), 30);
    doc.line(ttdX, namaY + 0.5, ttdX + ttdWidth, namaY + 0.5);

    // NIP Penandatangan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.text(`NIP. ${signerNip}`, ttdX, namaY + 3.2);

    // Footer Warning
    const noteText = customCatatan || meta.catatanKartu || `*Selama ${meta.singkatanUjian || 'tes'} berlangsung, kartu harus dibawa`;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(4.6);
    doc.setTextColor(71, 85, 105);
    doc.text(noteText, startX + 2.5, y + cardH - 1.8);

    // ---------------- RIGHT HALF: JADWAL TES ----------------
    const rightCenterX = startX + leftW + (rightW / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`JADWAL ${meta.namaUjian.toUpperCase()}`, rightCenterX, y + 3.2, { align: 'center' });

    doc.setFontSize(5.2);
    doc.text(`TAHUN AJARAN ${meta.tahunAjaran}`, rightCenterX, y + 5.7, { align: 'center' });

    // Table
    const tableLeft = startX + leftW + 1.2;
    const tableW = rightW - 2.4;

    autoTable(doc, {
      startY: y + 7.0,
      margin: { left: tableLeft },
      tableWidth: tableW,
      head: [['NO', 'Hari/Tanggal', 'Waktu', 'Mata Pelajaran', 'Paraf']],
      body: scheduleRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: tableFontSize + 0.3,
        halign: 'center',
        valign: 'middle',
        minCellHeight: targetHeadRowH,
        cellPadding: tableCellPadding,
        lineWidth: 0.18,
        lineColor: [100, 116, 139]
      },
      bodyStyles: {
        fontSize: tableFontSize,
        textColor: [15, 23, 42],
        cellPadding: tableCellPadding,
        valign: 'middle',
        minCellHeight: targetBodyRowH,
        lineWidth: 0.15,
        lineColor: [100, 116, 139]
      },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 24, halign: 'left' },
        2: { cellWidth: 17.5, halign: 'center' },
        3: { cellWidth: tableW - 6 - 24 - 17.5 - 13, halign: 'left' },
        4: { cellWidth: 13, halign: 'center' }
      }
    });
  });
}
