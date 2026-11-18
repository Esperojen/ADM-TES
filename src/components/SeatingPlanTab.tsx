import React, { useState, useRef, useEffect } from 'react';
import { 
  Room, 
  Seat, 
  Student, 
  SchoolMetadata,
  ValidationSummary
} from '../types';
import { 
  Users, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeftRight, 
  Sparkles,
  Info,
  Layers,
  GraduationCap,
  Eye,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';

interface SeatingPlanTabProps {
  rooms: Room[];
  selectedRoomId: number;
  metadata: SchoolMetadata;
  onSelectRoom: (roomId: number) => void;
  onSwapSeats: (source: { roomId: number; mejaNomor: number }, target: { roomId: number; mejaNomor: number }) => void;
  onOpenPdfForRoom: (roomId: number) => void;
}

export const SeatingPlanTab: React.FC<SeatingPlanTabProps> = ({
  rooms,
  selectedRoomId,
  metadata,
  onSelectRoom,
  onSwapSeats,
  onOpenPdfForRoom
}) => {
  const [highlightFilter, setHighlightFilter] = useState<'all' | 7 | 8 | 9 | 'L' | 'P' | 'top_rank'>('all');
  
  // Seat Swap selection state
  const [selectedSourceSeat, setSelectedSourceSeat] = useState<Seat | null>(null);
  const [draggedSeat, setDraggedSeat] = useState<Seat | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.95);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

    const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setZoomLevel(val / 100);
    }
  };

  const fitPage = () => {
    if (containerRef.current && contentRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32; // padding
      const containerHeight = containerRef.current.clientHeight - 32;
      
      const contentWidth = 900; // Fixed width layout
      const contentHeight = contentRef.current.offsetHeight; // Actual unscaled height

      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      
      const scale = Math.min(scaleX, scaleY);
      setZoomLevel(Number(Math.max(0.2, scale).toFixed(2)));
    }
  };

  useEffect(() => {
    // Zoom default 95%
    setZoomLevel(0.95);
  }, [activeRoom]);


  if (!activeRoom) {
    return (
      <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 text-slate-500">
        Belum ada data ruang yang tersedia.
      </div>
    );
  }

  // Handle click on seat for swapping
  const handleSeatClick = (seat: Seat) => {
    if (!selectedSourceSeat) {
      if (seat.student) {
        setSelectedSourceSeat(seat);
      }
    } else {
      if (selectedSourceSeat.mejaNomor === seat.mejaNomor) {
        // Deselect
        setSelectedSourceSeat(null);
      } else {
        // Execute swap
        onSwapSeats(
          { roomId: activeRoom.id, mejaNomor: selectedSourceSeat.mejaNomor },
          { roomId: activeRoom.id, mejaNomor: seat.mejaNomor }
        );
        setSelectedSourceSeat(null);
      }
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, seat: Seat) => {
    if (!seat.student) return;
    setDraggedSeat(seat);
    e.dataTransfer.setData('text/plain', String(seat.mejaNomor));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSeat: Seat) => {
    e.preventDefault();
    if (draggedSeat && draggedSeat.mejaNomor !== targetSeat.mejaNomor) {
      onSwapSeats(
        { roomId: activeRoom.id, mejaNomor: draggedSeat.mejaNomor },
        { roomId: activeRoom.id, mejaNomor: targetSeat.mejaNomor }
      );
    }
    setDraggedSeat(null);
  };

  // Helper to determine if seat is highlighted
  const isSeatHighlighted = (student: Student | null): boolean => {
    if (!student) return false;
    if (highlightFilter === 'all') return true;
    if (highlightFilter === 7 && student.jenjang === 7) return true;
    if (highlightFilter === 8 && student.jenjang === 8) return true;
    if (highlightFilter === 9 && student.jenjang === 9) return true;
    if (highlightFilter === 'L' && student.jenisKelamin === 'L') return true;
    if (highlightFilter === 'P' && student.jenisKelamin === 'P') return true;
    if (highlightFilter === 'top_rank' && student.peringkatJenjang && student.peringkatJenjang <= 5) return true;
    return false;
  };

  return (
    <div className="space-y-5">
      
      {/* Room Selector Pills */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>Pilih Ruangan Ujian:</span>
          </span>
          <span className="text-xs text-slate-500">
            Total {rooms.length} Ruang Aktif
          </span>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
          {rooms.map(r => {
            const isSelected = r.id === activeRoom.id;
            const hasViolations = (r.stats.pairViolations || 0) > 0;

            return (
              <button
                key={r.id}
                onClick={() => {
                  onSelectRoom(r.id);
                  setSelectedSourceSeat(null);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {hasViolations && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
                <div className="font-bold text-xs">{r.nama}</div>
                <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-teal-300' : 'text-slate-500'}`}>
                  {r.stats.totalSiswa} Siswa
                </div>
                <div className={`text-[9px] mt-0.5 font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  L:{r.stats.lakiLaki} P:{r.stats.perempuan}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room Details & Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {activeRoom.nama} — Denah Tempat Duduk
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                Kapasitas {activeRoom.kapasitas} Meja
              </span>
              {activeRoom.id === 9 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Khusus Ruang 9: Wajib Silang Jenjang (Beda Gender Diizinkan)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rincian: Kelas 7 ({activeRoom.stats.kelas7}) • Kelas 8 ({activeRoom.stats.kelas8}) • Kelas 9 ({activeRoom.stats.kelas9}) • Rata-rata Nilai: <strong className="text-slate-800">{activeRoom.stats.rataRataNilai}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedSourceSeat && (
              <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-900 animate-pulse">
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
                <span>Pilih Meja Sasaran untuk Ditukar dengan Meja {selectedSourceSeat.mejaNomor}</span>
                <button
                  onClick={() => setSelectedSourceSeat(null)}
                  className="ml-2 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Batal
                </button>
              </div>
            )}

            <button
              onClick={() => onOpenPdfForRoom(activeRoom.id)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-teal-300" />
              <span>Cetak / Pratinjau PDF Ruang Ini</span>
            </button>
          </div>
        </div>

        {/* Highlight Filter Tabs & Quick Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Highlight Options */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-slate-500 font-semibold shrink-0">Sorot:</span>
            {[
              { id: 'all', label: 'Semua' },
              { id: 7, label: 'Kelas 7' },
              { id: 8, label: 'Kelas 8' },
              { id: 9, label: 'Kelas 9' },
              { id: 'L', label: 'Laki-laki (L)' },
              { id: 'P', label: 'Perempuan (P)' },
              { id: 'top_rank', label: 'Top 5 Rank' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setHighlightFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                  highlightFilter === f.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Color Legend */}
          <div className="flex items-center space-x-3 text-[11px] text-slate-600">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-400" />
              <span>Laki-Laki (L)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-md bg-pink-100 border border-pink-400" />
              <span>Perempuan (P)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-3 rounded-md bg-amber-100 border border-rose-500" />
              <span>Peringatan Aturan</span>
            </div>
          </div>
        </div>

        {/* Visual Classroom Stage */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Visualisasi Denah Ruang</h3>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button onClick={fitPage} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Fit Layout">
              <Maximize className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button onClick={() => setZoomLevel(z => Math.max(0.1, z - 0.05))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom Out (-5%)">
              <ZoomOut className="w-4 h-4" />
            </button>
            <input 
              type="number" 
              value={Math.round(zoomLevel * 100)} 
              onChange={handleZoomInput}
              className="w-14 text-center text-xs font-bold text-slate-700 bg-transparent border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 hide-arrows"
              title="Ketik zoom (1-300)"
            />
            <span className="text-xs font-bold text-slate-500 -ml-2">%</span>
            <button onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.05))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom In (+5%)">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div ref={containerRef} className="bg-slate-100/90 rounded-2xl p-4 sm:p-6 border border-slate-300 overflow-auto h-[calc(100vh-320px)] min-h-[500px] relative">
          <div ref={contentRef} style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }} className="min-w-max pb-12 w-[900px] mx-auto">
            {/* Front Stage: Papan Tulis & Meja Pengawas */}
          <div className="relative mb-6">
            <div className="max-w-md mx-auto bg-white border-2 border-slate-300 rounded-xl py-2 px-4 shadow-2xs text-center">
              <div className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                [ PAPAN TULIS & MEJA PENGAWAS RUANG ]
              </div>
              <div className="text-[10px] text-slate-400">Bagian Depan Kelas</div>
            </div>

            {/* Pintu Masuk Badge */}
            <div className="absolute left-0 top-0 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-2xs flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>PINTU MASUK</span>
            </div>
          </div>

          {/* Seating Grid: 4 Rows x 8 Columns (4 Pairs per Row separated by Aisles) */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map(rowNum => {
              return (
                <div key={rowNum} className="flex flex-col lg:flex-row items-center justify-between gap-2.5">
                  
                  {/* Row Indicator Badge */}
                  <div className="hidden lg:flex items-center justify-center w-6 text-xs font-bold text-slate-400">
                    B{rowNum}
                  </div>

                  {/* 4 Pairs of Desks in this Row */}
                  {[0, 1, 2, 3].map(pairColIndex => {
                    const pairIndex = (rowNum - 1) * 4 + pairColIndex;
                    const leftCol = pairColIndex * 2 + 1;
                    const rightCol = pairColIndex * 2 + 2;

                    const leftMejaNomor = (rowNum - 1) * 8 + leftCol;
                    const rightMejaNomor = (rowNum - 1) * 8 + rightCol;

                    const leftSeat = activeRoom.seats.find(s => s.mejaNomor === leftMejaNomor);
                    const rightSeat = activeRoom.seats.find(s => s.mejaNomor === rightMejaNomor);

                    const isPairMismatchedGender = leftSeat?.isViolatingGender || rightSeat?.isViolatingGender;
                    const isPairMismatchedGrade = leftSeat?.isViolatingGrade || rightSeat?.isViolatingGrade;

                    return (
                      <div key={pairColIndex} className="flex items-center space-x-1 w-full lg:w-auto">
                        
                        {/* Left Desk */}
                        {leftSeat && (
                          <DeskCard
                            seat={leftSeat}
                            isHighlighted={isSeatHighlighted(leftSeat.student)}
                            isSelectedForSwap={selectedSourceSeat?.mejaNomor === leftSeat.mejaNomor}
                            onClick={() => handleSeatClick(leftSeat)}
                            onDragStart={e => handleDragStart(e, leftSeat)}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDrop(e, leftSeat)}
                          />
                        )}

                        {/* Right Desk */}
                        {rightSeat && (
                          <DeskCard
                            seat={rightSeat}
                            isHighlighted={isSeatHighlighted(rightSeat.student)}
                            isSelectedForSwap={selectedSourceSeat?.mejaNomor === rightSeat.mejaNomor}
                            onClick={() => handleSeatClick(rightSeat)}
                            onDragStart={e => handleDragStart(e, rightSeat)}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDrop(e, rightSeat)}
                          />
                        )}

                        {/* Aisle Divider Indicator (Between Pair 1&2, 2&3, 3&4) */}
                        {pairColIndex < 3 && (
                          <div className="hidden lg:flex flex-col items-center justify-center px-1.5 text-[9px] font-mono text-slate-400 select-none">
                            <div className="h-8 border-l border-dashed border-slate-300" />
                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              );
            })}
          </div>

          {/* Bottom Classroom Info */}
          <div className="mt-6 pt-3 border-t border-slate-300 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              💡 <em>Tips: Klik meja untuk memilih siswa, lalu klik meja lain untuk menukar (swap) posisi duduk.</em>
            </div>
            <div className="font-semibold text-slate-700">
              Bagian Belakang Kelas (Baris 4)
            </div>
          </div>

        </div>

      </div>

    </div>
</div>
  );
};

// Sub-component for individual Desk Card
interface DeskCardProps {
  seat: Seat;
  isHighlighted: boolean;
  isSelectedForSwap: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const DeskCard: React.FC<DeskCardProps> = ({
  seat,
  isHighlighted,
  isSelectedForSwap,
  onClick,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const s = seat.student;
  const isMale = s?.jenisKelamin === 'L';
  const hasViolation = seat.isViolatingGender || seat.isViolatingGrade;

  return (
    <div
      draggable={!!s}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      title={s ? `Meja ${seat.mejaNomor}: ${s.nama} (${s.kelasAsal}) - Klik untuk tukar posisi` : `Meja ${seat.mejaNomor}: Kosong`}
      className={`relative w-full sm:w-32 lg:w-34 p-2 sm:p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left ${
        isSelectedForSwap
          ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500 shadow-md scale-102 z-10'
          : hasViolation
          ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
          : s
          ? isMale
            ? 'bg-blue-50/90 border-blue-200 hover:border-blue-400 shadow-2xs hover:shadow-xs'
            : 'bg-pink-50/90 border-pink-200 hover:border-pink-400 shadow-2xs hover:shadow-xs'
          : 'bg-slate-50 border-slate-200 border-dashed text-slate-400'
      } ${!isHighlighted ? 'opacity-30' : 'opacity-100'}`}
    >
      
      {/* Top Header: Desk Number & Gender/Class Badge */}
      <div className="flex items-center justify-between mb-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
          s 
            ? isMale ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
            : 'bg-slate-300 text-slate-700'
        }`}>
          M-{String(seat.mejaNomor).padStart(2, '0')}
        </span>

        {s && (
          <div className="flex items-center space-x-1">
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              s.jenjang === 9 
                ? 'bg-purple-100 text-purple-800' 
                : s.jenjang === 8 
                ? 'bg-indigo-100 text-indigo-800' 
                : 'bg-teal-100 text-teal-800'
            }`}>
              {s.kelasAsal}
            </span>
            <span className={`text-[10px] font-bold ${isMale ? 'text-blue-700' : 'text-pink-700'}`}>
              ({s.jenisKelamin})
            </span>
          </div>
        )}
      </div>

      {/* Student Details */}
      {s ? (
        <div className="space-y-0.5">
          <div className="font-bold text-[11px] text-slate-900 truncate tracking-tight" title={s.nama}>
            {s.nama}
          </div>
          <div className="text-[9.5px] text-slate-600 font-mono flex items-center justify-between">
            <span className="font-semibold text-slate-800">NISN: {s.nisn || '-'}</span>
            <span className="font-bold text-slate-700">★ {s.nilaiRataRata.toFixed(1)}</span>
          </div>
          <div className="text-[9px] text-slate-400 flex items-center justify-between">
            <span>No: {s.nomorPeserta || '-'}</span>
            {s.peringkatJenjang ? (
              <span className="text-teal-700 font-semibold">Rank #{s.peringkatJenjang}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="py-2 text-center text-[11px] font-medium text-slate-400">
          KOSONG
        </div>
      )}

      {/* Violation Alert Badge */}
      {hasViolation && (
        <div className="mt-1 pt-1 border-t border-rose-200 text-[9px] font-bold text-rose-700 flex items-center space-x-1">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-600" />
          <span className="truncate">
            {seat.isViolatingGrade ? 'Jenjang Sama' : 'Gender Berbeda'}
          </span>
        </div>
      )}

    </div>
  );
};
