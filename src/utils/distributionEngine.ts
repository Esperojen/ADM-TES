import { 
  Student, 
  Room, 
  Seat, 
  DistributionConfig, 
  ValidationSummary, 
  RoomStats 
} from '../types';

export const DEFAULT_CONFIG: DistributionConfig = {
  jumlahRuang: 9,
  kapasitasPerRuang: 32,
  modelPembagian: 'tiered_homogen', // Ranking tinggi di ruang 1, dst.
  dasarRanking: 'average',
  strategiSilang: 'cross_9_with_8_and_8_with_7',
  utamakanRankingTinggiDiRuangAwal: true,
  wajibJenisKelaminSama: true,
  wajibJenjangBerbeda: true,
  prefixNomorPeserta: 'grade_based'
};

export function calculateRankings(students: Student[], dasarRanking: string = 'average'): Student[] {
  // Extract score for ranking
  const getScore = (s: Student): number => {
    if (dasarRanking === 'average' || !s.nilaiMataPelajaran[dasarRanking]) {
      return s.nilaiRataRata || 0;
    }
    return s.nilaiMataPelajaran[dasarRanking] || 0;
  };

  // Clone
  const cloned = students.map(s => ({ ...s, scoreForRanking: getScore(s) }));

  // Overall ranking
  cloned.sort((a, b) => (b as any).scoreForRanking - (a as any).scoreForRanking);
  cloned.forEach((s, idx) => {
    s.peringkatKeseluruhan = idx + 1;
  });

  // Grade ranking
  [7, 8, 9].forEach(grade => {
    const gradeStudents = cloned.filter(s => s.jenjang === grade);
    gradeStudents.sort((a, b) => (b as any).scoreForRanking - (a as any).scoreForRanking);
    gradeStudents.forEach((s, idx) => {
      s.peringkatJenjang = idx + 1;
    });
  });

  return cloned.map(({ ...rest }) => rest as Student);
}

function initializeEmptySeats(kapasitas: number): Seat[] {
  const seats: Seat[] = [];
  const rows = 4;
  const cols = 8;

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const mejaNomor = (r - 1) * cols + c;
      if (mejaNomor > kapasitas) continue;

      // Pair logic: 
      // Columns 1 & 2 = pair 0 in row (pairIndex 0, 4, 8, 12)
      // Columns 3 & 4 = pair 1 in row (pairIndex 1, 5, 9, 13)
      // Columns 5 & 6 = pair 2 in row (pairIndex 2, 6, 10, 14)
      // Columns 7 & 8 = pair 3 in row (pairIndex 3, 7, 11, 15)
      const pairColIndex = Math.floor((c - 1) / 2);
      const pairIndex = (r - 1) * 4 + pairColIndex;
      const isLeft = (c % 2) === 1;
      const pasanganMejaNomor = isLeft ? mejaNomor + 1 : mejaNomor - 1;

      seats.push({
        mejaNomor,
        baris: r,
        kolom: c,
        pasanganMejaNomor,
        pairIndex,
        positionInPair: isLeft ? 'left' : 'right',
        student: null
      });
    }
  }

  return seats;
}

export function distributeStudentsToRooms(
  rawStudents: Student[],
  config: DistributionConfig
): { rooms: Room[]; validation: ValidationSummary } {
  const students = calculateRankings(rawStudents, config.dasarRanking);
  const totalCount = students.length;
  const numRooms = config.jumlahRuang || Math.ceil(totalCount / config.kapasitasPerRuang) || 9;
  const capacity = config.kapasitasPerRuang || 32;

  // Initialize rooms
  const rooms: Room[] = [];
  for (let i = 1; i <= numRooms; i++) {
    const roomName = `Ruang ${String(i).padStart(2, '0')}`;
    rooms.push({
      id: i,
      nama: roomName,
      kapasitas: capacity,
      seats: initializeEmptySeats(capacity),
      stats: {
        totalSiswa: 0,
        kapasitas: capacity,
        lakiLaki: 0,
        perempuan: 0,
        kelas7: 0,
        kelas8: 0,
        kelas9: 0,
        rataRataNilai: 0,
        pairViolations: 0
      }
    });
  }

  if (totalCount === 0) {
    return {
      rooms,
      validation: {
        totalMurid: 0,
        muridDitempatkan: 0,
        muridBelumDitempatkan: 0,
        totalPasangan: 0,
        pasanganValid: 0,
        pelanggaranJenjang: 0,
        pelanggaranGender: 0,
        status: 'Sempurna',
        details: ['Belum ada data murid yang dimasukkan.']
      }
    };
  }

  // Segment by Grade & Gender
  const pools: Record<string, Student[]> = {
    '7_L': students.filter(s => s.jenjang === 7 && s.jenisKelamin === 'L').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
    '7_P': students.filter(s => s.jenjang === 7 && s.jenisKelamin === 'P').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
    '8_L': students.filter(s => s.jenjang === 8 && s.jenisKelamin === 'L').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
    '8_P': students.filter(s => s.jenjang === 8 && s.jenisKelamin === 'P').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
    '9_L': students.filter(s => s.jenjang === 9 && s.jenisKelamin === 'L').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
    '9_P': students.filter(s => s.jenjang === 9 && s.jenisKelamin === 'P').sort((a, b) => (a.peringkatJenjang || 0) - (b.peringkatJenjang || 0)),
  };

  // Define room grade pairing assignment
  // For 9 rooms with Grades 7, 8, 9:
  // Ruang 1-3: Grade 9 & Grade 8
  // Ruang 4-6: Grade 8 & Grade 7
  // Ruang 7-9: Grade 9 & Grade 7
  const roomGradePairs: Array<{ gradeA: 7 | 8 | 9; gradeB: 7 | 8 | 9 }> = [];

  const distinctGrades = Array.from(new Set(students.map(s => s.jenjang))).sort();

  if (distinctGrades.length === 3) {
    const chunk = Math.ceil(numRooms / 3);
    for (let r = 0; r < numRooms; r++) {
      if (r < chunk) {
        roomGradePairs.push({ gradeA: 9, gradeB: 8 });
      } else if (r < chunk * 2) {
        roomGradePairs.push({ gradeA: 8, gradeB: 7 });
      } else {
        roomGradePairs.push({ gradeA: 9, gradeB: 7 });
      }
    }
  } else if (distinctGrades.length === 2) {
    const gA = distinctGrades[1] as 7 | 8 | 9;
    const gB = distinctGrades[0] as 7 | 8 | 9;
    for (let r = 0; r < numRooms; r++) {
      roomGradePairs.push({ gradeA: gA, gradeB: gB });
    }
  } else if (distinctGrades.length === 1) {
    const gA = distinctGrades[0] as 7 | 8 | 9;
    for (let r = 0; r < numRooms; r++) {
      roomGradePairs.push({ gradeA: gA, gradeB: gA });
    }
  }

  // Work with pools by taking students for each room
  // We allocate 16 pairs per room (4 rows x 4 pairs = 16 pairs)
  // For each room, we calculate how many male pairs and female pairs based on available counts
  for (let rIdx = 0; rIdx < numRooms; rIdx++) {
    const room = rooms[rIdx];
    const pairConfig = roomGradePairs[rIdx] || { gradeA: 9, gradeB: 8 };
    const gA = pairConfig.gradeA;
    const gB = pairConfig.gradeB;

    const poolAL = pools[`${gA}_L`];
    const poolAP = pools[`${gA}_P`];
    const poolBL = pools[`${gB}_L`];
    const poolBP = pools[`${gB}_P`];

    // Total pairs in this room is capacity / 2 (standard 16 pairs)
    const maxPairs = Math.floor(capacity / 2);
    const malePairs: Array<{ left: Student; right: Student }> = [];
    const femalePairs: Array<{ left: Student; right: Student }> = [];

    // Helper to pull pair
    const takePair = (pool1: Student[], pool2: Student[]): { left: Student; right: Student } | null => {
      if (pool1.length > 0 && pool2.length > 0) {
        const s1 = pool1.shift()!;
        const s2 = pool2.shift()!;
        return { left: s1, right: s2 };
      }
      return null;
    };

    // Check if this is Ruang 9 (special rule: adjacent students must NOT have the same grade, but gender may differ)
    const isRuang9 = room.id === 9 || rIdx === 8;

    if (isRuang9) {
      // Khusus Ruang 9: Siswa bersebelahan tidak boleh jenjang sama, namun boleh beda gender
      // "buat sedemikian rupa sehingga siswa yang bersebelahan jangan ada yang jenjang sama, tapi tidak apa gender berbeda. khusus untuk ruang 9"
      const roomPairs: Array<{ left: Student; right: Student }> = [];

      // 1. Prioritaskan pasangan jenjang berbeda dengan gender sama jika tersedia
      while (roomPairs.length < maxPairs && poolAL.length > 0 && poolBL.length > 0) {
        const p = takePair(poolAL, poolBL);
        if (p) roomPairs.push(p);
      }
      while (roomPairs.length < maxPairs && poolAP.length > 0 && poolBP.length > 0) {
        const p = takePair(poolAP, poolBP);
        if (p) roomPairs.push(p);
      }

      // 2. Pasangkan silang gender antara jenjang berbeda (Grade A dengan Grade B)
      while (roomPairs.length < maxPairs) {
        const sA = poolAL.length > 0 ? poolAL.shift() : (poolAP.length > 0 ? poolAP.shift() : null);
        const sB = poolBL.length > 0 ? poolBL.shift() : (poolBP.length > 0 ? poolBP.shift() : null);

        if (sA && sB) {
          roomPairs.push({ left: sA, right: sB });
        } else {
          // Kembalikan ke pool jika hanya satu yang dapat diambil
          if (sA) {
            if (sA.jenisKelamin === 'L') poolAL.unshift(sA);
            else poolAP.unshift(sA);
          }
          if (sB) {
            if (sB.jenisKelamin === 'L') poolBL.unshift(sB);
            else poolBP.unshift(sB);
          }
          break;
        }
      }

      // 3. Fallback jika masih ada kombinasi jenjang lain yang tersisa
      while (roomPairs.length < maxPairs) {
        const allAvailable = [
          ...pools['9_L'], ...pools['9_P'],
          ...pools['8_L'], ...pools['8_P'],
          ...pools['7_L'], ...pools['7_P']
        ];
        const distinctGrades = Array.from(new Set(allAvailable.map(s => s.jenjang)));
        if (distinctGrades.length >= 2) {
          const g1 = distinctGrades[0];
          const g2 = distinctGrades[1];
          const pool1 = (pools[`${g1}_L`].length > 0 ? pools[`${g1}_L`] : pools[`${g1}_P`]);
          const pool2 = (pools[`${g2}_L`].length > 0 ? pools[`${g2}_L`] : pools[`${g2}_P`]);
          if (pool1.length > 0 && pool2.length > 0) {
            roomPairs.push({ left: pool1.shift()!, right: pool2.shift()! });
            continue;
          }
        }
        break;
      }

      // Tempatkan pasangan meja ke denah ruang (16 pasang meja)
      roomPairs.forEach((pair, pIdx) => {
        if (pIdx >= 16) return;
        const leftSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left');
        const rightSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right');
        if (leftSeat) {
          pair.left.nomorPeserta = `R${String(room.id).padStart(2, '0')}-${pair.left.kelasAsal}-${String(leftSeat.mejaNomor).padStart(2, '0')}`;
          leftSeat.student = pair.left;
        }
        if (rightSeat) {
          pair.right.nomorPeserta = `R${String(room.id).padStart(2, '0')}-${pair.right.kelasAsal}-${String(rightSeat.mejaNomor).padStart(2, '0')}`;
          rightSeat.student = pair.right;
        }
      });
    } else {
      // Ruang 1-8: Pertahankan aturan bawaan secara utuh
      // Calculate ratio of Males vs Females remaining
      const totalRemainingMale = (poolAL.length + poolBL.length);
      const totalRemainingFemale = (poolAP.length + poolBP.length);
      const remainingRatioMale = totalRemainingMale / (totalRemainingMale + totalRemainingFemale || 1);
      
      // Determine target male pairs and female pairs for this room
      let targetMalePairs = Math.round(maxPairs * remainingRatioMale);
      let targetFemalePairs = maxPairs - targetMalePairs;

      // 1. Try to create Male pairs (Grade A Male + Grade B Male)
      let createdMale = 0;
      while (createdMale < targetMalePairs && poolAL.length > 0 && poolBL.length > 0) {
        const p = takePair(poolAL, poolBL);
        if (p) {
          malePairs.push(p);
          createdMale++;
        }
      }

      // 2. Try to create Female pairs (Grade A Female + Grade B Female)
      let createdFemale = 0;
      while (createdFemale < targetFemalePairs && poolAP.length > 0 && poolBP.length > 0) {
        const p = takePair(poolAP, poolBP);
        if (p) {
          femalePairs.push(p);
          createdFemale++;
        }
      }

      // 3. If room still has pair slots available, fill with any remaining cross-grade pairs
      while (malePairs.length + femalePairs.length < maxPairs) {
        if (poolAL.length > 0 && poolBL.length > 0) {
          const p = takePair(poolAL, poolBL);
          if (p) { malePairs.push(p); continue; }
        }
        if (poolAP.length > 0 && poolBP.length > 0) {
          const p = takePair(poolAP, poolBP);
          if (p) { femalePairs.push(p); continue; }
        }
        // If one pool of primary grade pair is exhausted, try fallback pairing with other pools
        const allMalePools = [pools['9_L'], pools['8_L'], pools['7_L']].filter(p => p.length > 0);
        if (allMalePools.length >= 2) {
          const s1 = allMalePools[0].shift()!;
          const s2 = allMalePools[1].shift()!;
          malePairs.push({ left: s1, right: s2 });
          continue;
        }
        const allFemalePools = [pools['9_P'], pools['8_P'], pools['7_P']].filter(p => p.length > 0);
        if (allFemalePools.length >= 2) {
          const s1 = allFemalePools[0].shift()!;
          const s2 = allFemalePools[1].shift()!;
          femalePairs.push({ left: s1, right: s2 });
          continue;
        }
        // If single student left in male or female
        break;
      }

      // Interleave male and female pairs: 1 Male, 1 Female, 1 Male...
      const roomPairs: Array<{ left: Student; right: Student }> = [];
      const maxInterleave = Math.max(malePairs.length, femalePairs.length);
      for (let i = 0; i < maxInterleave; i++) {
        if (i < malePairs.length) roomPairs.push(malePairs[i]);
        if (i < femalePairs.length) roomPairs.push(femalePairs[i]);
      }

      // Now place roomPairs into the room seats (16 pairs max across 4 rows x 4 pairs per row)
      roomPairs.forEach((pair, pIdx) => {
        if (pIdx >= 16) return;
        const leftSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left');
        const rightSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right');
        if (leftSeat) {
          pair.left.nomorPeserta = `R${String(room.id).padStart(2, '0')}-${pair.left.kelasAsal}-${String(leftSeat.mejaNomor).padStart(2, '0')}`;
          leftSeat.student = pair.left;
        }
        if (rightSeat) {
          pair.right.nomorPeserta = `R${String(room.id).padStart(2, '0')}-${pair.right.kelasAsal}-${String(rightSeat.mejaNomor).padStart(2, '0')}`;
          rightSeat.student = pair.right;
        }
      });
    }
  }

  // Check if any leftover students exist across all pools
  const leftoverStudents: Student[] = [];
  Object.values(pools).forEach(p => {
    while (p.length > 0) {
      leftoverStudents.push(p.shift()!);
    }
  });

  // Distribute leftover students into any remaining empty seats across rooms
  // If placing in Ruang 9, strictly ensure adjacent seats do not share the same grade
  if (leftoverStudents.length > 0) {
    for (const room of rooms) {
      for (const seat of room.seats) {
        if (!seat.student && leftoverStudents.length > 0) {
          const seatmate = room.seats.find(s => s.pairIndex === seat.pairIndex && s.mejaNomor !== seat.mejaNomor)?.student;
          let sIdx = 0;
          if (seatmate) {
            const diffGradeIdx = leftoverStudents.findIndex(s => s.jenjang !== seatmate.jenjang);
            if (diffGradeIdx !== -1) {
              sIdx = diffGradeIdx;
            }
          }
          const s = leftoverStudents.splice(sIdx, 1)[0];
          s.nomorPeserta = `R${String(room.id).padStart(2, '0')}-${s.kelasAsal}-${String(seat.mejaNomor).padStart(2, '0')}`;
          seat.student = s;
        }
      }
    }
  }

  // Validate every seat & compute room statistics
  let totalPlaced = 0;
  let totalPairsChecked = 0;
  let validPairsCount = 0;
  let gradeViolations = 0;
  let genderViolations = 0;
  const detailNotes: string[] = [];

  rooms.forEach(room => {
    let roomStudentsCount = 0;
    let roomMale = 0;
    let roomFemale = 0;
    let room7 = 0;
    let room8 = 0;
    let room9 = 0;
    let roomScoreSum = 0;
    let roomViolations = 0;

    // Check each pair (0 to 15)
    for (let pIdx = 0; pIdx < 16; pIdx++) {
      const leftSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left');
      const rightSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right');

      const sLeft = leftSeat?.student;
      const sRight = rightSeat?.student;

      if (sLeft && sRight) {
        totalPairsChecked++;
        let pairOk = true;

        // Check Gender rule - waived for Ruang 9 per user request: "tapi tidak apa gender berbeda. khusus untuk ruang 9"
        const isRuang9 = room.id === 9 || room.nama.includes('9') || room.nama.includes('09');
        if (sLeft.jenisKelamin !== sRight.jenisKelamin) {
          if (!isRuang9) {
            genderViolations++;
            pairOk = false;
            if (leftSeat) leftSeat.isViolatingGender = true;
            if (rightSeat) rightSeat.isViolatingGender = true;
            roomViolations++;
          }
        }

        // Check Grade rule - strictly enforced!
        if (sLeft.jenjang === sRight.jenjang) {
          gradeViolations++;
          pairOk = false;
          if (leftSeat) leftSeat.isViolatingGrade = true;
          if (rightSeat) rightSeat.isViolatingGrade = true;
          roomViolations++;
        }

        if (pairOk) {
          validPairsCount++;
        }
      }
    }

    room.seats.forEach(seat => {
      if (seat.student) {
        totalPlaced++;
        roomStudentsCount++;
        if (seat.student.jenisKelamin === 'L') roomMale++;
        else roomFemale++;

        if (seat.student.jenjang === 7) room7++;
        else if (seat.student.jenjang === 8) room8++;
        else if (seat.student.jenjang === 9) room9++;

        roomScoreSum += seat.student.nilaiRataRata || 0;
      }
    });

    room.stats = {
      totalSiswa: roomStudentsCount,
      kapasitas: room.kapasitas,
      lakiLaki: roomMale,
      perempuan: roomFemale,
      kelas7: room7,
      kelas8: room8,
      kelas9: room9,
      rataRataNilai: roomStudentsCount > 0 ? Number((roomScoreSum / roomStudentsCount).toFixed(2)) : 0,
      pairViolations: roomViolations
    };
  });

  const unplacedCount = leftoverStudents.length;

  if (gradeViolations > 0) {
    detailNotes.push(`Terdapat ${gradeViolations} pasangan meja dengan jenjang kelas yang sama.`);
  }
  if (genderViolations > 0) {
    detailNotes.push(`Terdapat ${genderViolations} pasangan meja dengan jenis kelamin berbeda.`);
  }
  if (unplacedCount > 0) {
    detailNotes.push(`Terdapat ${unplacedCount} siswa yang belum mendapatkan kursi karena kapasitas ruang penuh.`);
  }
  if (detailNotes.length === 0) {
    detailNotes.push('Semua siswa berhasil ditempatkan sesuai aturan silang jenjang dan pemisahan jenis kelamin.');
  }

  const validation: ValidationSummary = {
    totalMurid: totalCount,
    muridDitempatkan: totalPlaced,
    muridBelumDitempatkan: unplacedCount,
    totalPasangan: totalPairsChecked,
    pasanganValid: validPairsCount,
    pelanggaranJenjang: gradeViolations,
    pelanggaranGender: genderViolations,
    status: (gradeViolations === 0 && genderViolations === 0 && unplacedCount === 0) 
      ? 'Sempurna' 
      : (unplacedCount > 0 ? 'Perlu Penyesuaian' : 'Peringatan'),
    details: detailNotes
  };

  return { rooms, validation };
}

export function swapSeats(
  rooms: Room[],
  source: { roomId: number; mejaNomor: number },
  target: { roomId: number; mejaNomor: number }
): Room[] {
  const cloned = JSON.parse(JSON.stringify(rooms)) as Room[];
  const sourceRoom = cloned.find(r => r.id === source.roomId);
  const targetRoom = cloned.find(r => r.id === target.roomId);

  if (!sourceRoom || !targetRoom) return rooms;

  const sourceSeat = sourceRoom.seats.find(s => s.mejaNomor === source.mejaNomor);
  const targetSeat = targetRoom.seats.find(s => s.mejaNomor === target.mejaNomor);

  if (!sourceSeat || !targetSeat) return rooms;

  const temp = sourceSeat.student;
  sourceSeat.student = targetSeat.student;
  targetSeat.student = temp;

  // Re-validate affected rooms
  [sourceRoom, targetRoom].forEach(room => {
    let roomViolations = 0;
    let roomMale = 0;
    let roomFemale = 0;
    let room7 = 0;
    let room8 = 0;
    let room9 = 0;
    let scoreSum = 0;
    let count = 0;

    for (let pIdx = 0; pIdx < 16; pIdx++) {
      const leftSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left');
      const rightSeat = room.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right');
      if (leftSeat) { leftSeat.isViolatingGender = false; leftSeat.isViolatingGrade = false; }
      if (rightSeat) { rightSeat.isViolatingGender = false; rightSeat.isViolatingGrade = false; }

      if (leftSeat?.student && rightSeat?.student) {
        const isRuang9 = room.id === 9 || room.nama.includes('9') || room.nama.includes('09');
        if (leftSeat.student.jenisKelamin !== rightSeat.student.jenisKelamin) {
          if (!isRuang9) {
            leftSeat.isViolatingGender = true;
            rightSeat.isViolatingGender = true;
            roomViolations++;
          }
        }
        if (leftSeat.student.jenjang === rightSeat.student.jenjang) {
          leftSeat.isViolatingGrade = true;
          rightSeat.isViolatingGrade = true;
          roomViolations++;
        }
      }
    }

    room.seats.forEach(seat => {
      if (seat.student) {
        count++;
        if (seat.student.jenisKelamin === 'L') roomMale++;
        else roomFemale++;
        if (seat.student.jenjang === 7) room7++;
        else if (seat.student.jenjang === 8) room8++;
        else if (seat.student.jenjang === 9) room9++;
        scoreSum += seat.student.nilaiRataRata || 0;
      }
    });

    room.stats = {
      totalSiswa: count,
      kapasitas: room.kapasitas,
      lakiLaki: roomMale,
      perempuan: roomFemale,
      kelas7: room7,
      kelas8: room8,
      kelas9: room9,
      rataRataNilai: count > 0 ? Number((scoreSum / count).toFixed(2)) : 0,
      pairViolations: roomViolations
    };
  });

  return cloned;
}

export const swapStudentSeats = swapSeats;

export function validateRoomAllocation(rooms: Room[], totalStudentsCount: number): ValidationSummary {
  let placedCount = 0;
  let genderViolations = 0;
  let gradeViolations = 0;
  let totalPairsWithStudents = 0;
  let validPairs = 0;
  const detailNotes: string[] = [];

  rooms.forEach(r => {
    let placedInRoom = 0;
    r.seats.forEach(s => {
      if (s.student) {
        placedCount++;
        placedInRoom++;
      }
    });

    for (let pIdx = 0; pIdx < 16; pIdx++) {
      const leftSeat = r.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'left');
      const rightSeat = r.seats.find(s => s.pairIndex === pIdx && s.positionInPair === 'right');

      if (leftSeat?.student && rightSeat?.student) {
        totalPairsWithStudents++;
        let pairOk = true;
        const isRuang9 = r.id === 9 || r.nama.includes('9') || r.nama.includes('09');
        if (leftSeat.student.jenisKelamin !== rightSeat.student.jenisKelamin) {
          if (!isRuang9) {
            genderViolations++;
            pairOk = false;
          }
        }
        if (leftSeat.student.jenjang === rightSeat.student.jenjang) {
          gradeViolations++;
          pairOk = false;
        }
        if (pairOk) {
          validPairs++;
        }
      }
    }
  });

  const unplaced = Math.max(0, totalStudentsCount - placedCount);
  const status = (genderViolations === 0 && gradeViolations === 0 && unplaced === 0)
    ? 'Sempurna'
    : (unplaced > 0 ? 'Perlu Penyesuaian' : 'Peringatan');

  return {
    totalMurid: totalStudentsCount,
    muridDitempatkan: placedCount,
    muridBelumDitempatkan: unplaced,
    totalPasangan: totalPairsWithStudents,
    pasanganValid: validPairs,
    pelanggaranGender: genderViolations,
    pelanggaranJenjang: gradeViolations,
    status,
    details: detailNotes
  };
}

