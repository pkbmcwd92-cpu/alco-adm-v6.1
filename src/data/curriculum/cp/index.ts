import { CurriculumPhase, SchoolLevel } from '../types';
import { MasterCPEntry } from './types';
import { SD_CP_ENTRIES } from './sd';
import { SMP_CP_ENTRIES } from './smp';
import { SMA_CP_ENTRIES } from './sma';
import { findSubjectByNameOrAlias, findSubjectByCode } from '../subjects';

export * from './types';
export { SD_CP_ENTRIES } from './sd';
export { SMP_CP_ENTRIES } from './smp';
export { SMA_CP_ENTRIES } from './sma';

export const ALL_MASTER_CP_ENTRIES: MasterCPEntry[] = [
  ...SD_CP_ENTRIES,
  ...SMP_CP_ENTRIES,
  ...SMA_CP_ENTRIES,
];

export interface ResolveCPOptions {
  subjectCode?: string;
  subjectInput?: string;
  subjectCodeOrName?: string;
  phase: CurriculumPhase;
  academicYear?: string;
  level?: SchoolLevel;
  entriesPool?: MasterCPEntry[];
}

export interface CPResolutionResult {
  cp: MasterCPEntry | null;
  entry?: MasterCPEntry | null;
  status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
  candidates?: MasterCPEntry[];
  reason?: string;
}

/**
 * Menyelesaikan Capaian Pembelajaran resmi berdasarkan mata pelajaran dan fase.
 * Mencegah pengembalian kandidat pertama saat terjadi ambiguitas (status AMBIGUOUS jika > 1).
 * Mendukung baik pemanggilan dengan positional arguments maupun options object.
 */
export function resolveCPContext(
  subjectOrOptions: string | ResolveCPOptions,
  phaseArg?: CurriculumPhase,
  academicYearArg?: string
): CPResolutionResult {
  let subjectInput = '';
  let phase: CurriculumPhase;
  let academicYear: string | undefined;
  let levelFilter: SchoolLevel | undefined;
  let sourcePool = ALL_MASTER_CP_ENTRIES;

  if (typeof subjectOrOptions === 'object' && subjectOrOptions !== null) {
    subjectInput =
      subjectOrOptions.subjectCode ||
      subjectOrOptions.subjectInput ||
      subjectOrOptions.subjectCodeOrName ||
      '';
    phase = subjectOrOptions.phase;
    academicYear = subjectOrOptions.academicYear;
    levelFilter = subjectOrOptions.level;
    if (subjectOrOptions.entriesPool) {
      sourcePool = subjectOrOptions.entriesPool;
    }
  } else {
    subjectInput = typeof subjectOrOptions === 'string' ? subjectOrOptions : '';
    phase = phaseArg!;
    academicYear = academicYearArg;
  }

  if (!subjectInput || !phase) {
    return {
      cp: null,
      entry: null,
      status: 'UNRESOLVED',
      candidates: [],
      reason: 'Parameter subjectInput atau phase tidak valid/kosong.',
    };
  }

  const subject =
    findSubjectByCode(subjectInput) || findSubjectByNameOrAlias(subjectInput);
  const code = subject ? subject.code : subjectInput.toUpperCase().trim();

  let baseCandidates = sourcePool.filter(
    (cp) => cp.subjectCode === code && cp.phase === phase
  );

  if (levelFilter) {
    baseCandidates = baseCandidates.filter((cp) => cp.level === levelFilter);
  }

  if (baseCandidates.length === 0) {
    return {
      cp: null,
      entry: null,
      status: 'UNRESOLVED',
      candidates: [],
      reason: `Tidak ditemukan Capaian Pembelajaran untuk mata pelajaran ${code} pada Fase ${phase}.`,
    };
  }

  let candidates: MasterCPEntry[] = [];

  if (academicYear) {
    const yearMatch = academicYear.match(/\d{4}/);
    const startYear = yearMatch ? parseInt(yearMatch[0], 10) : null;
    if (startYear) {
      const yearDate = `${startYear}-07-01`;
      candidates = baseCandidates.filter((cp) => {
        const from = cp.effectiveFrom || '1970-01-01';
        const until = cp.effectiveUntil || '9999-12-31';

        // 1. Cek kesesuaian rentang tanggal berlaku
        const inDateRange = from <= yearDate && yearDate <= until;
        if (inDateRange) {
          return true;
        }

        // 2. Jika tidak ada batasan tanggal eksplisit, gunakan implementationFromAcademicYear
        if (!cp.effectiveFrom && !cp.effectiveUntil && cp.implementationFromAcademicYear) {
          return cp.implementationFromAcademicYear === academicYear;
        }

        return false;
      });
    }
  } else {
    // Tanpa filter tahun ajaran spesifik: hanya ambil kandidat yang aktif saat ini (tidak superseded dan belum kedaluwarsa)
    candidates = baseCandidates.filter((c) => {
      if (c.verificationStatus === 'SUPERSEDED') return false;
      if (c.effectiveUntil && c.effectiveUntil < '2026-07-01') return false;
      return true;
    });
  }

  if (candidates.length === 1) {
    return {
      cp: candidates[0],
      entry: candidates[0],
      status: 'RESOLVED',
      candidates,
    };
  }

  if (candidates.length > 1) {
    return {
      cp: null,
      entry: null,
      status: 'AMBIGUOUS',
      candidates,
      reason: `Ditemukan ${candidates.length} Capaian Pembelajaran aktif untuk ${code} Fase ${phase}. Memerlukan spesifikasi tahun ajaran/regulasi lebih spesifik agar tidak menggunakan first-candidate sembarangan.`,
    };
  }

  return {
    cp: null,
    entry: null,
    status: 'UNRESOLVED',
    candidates: [],
    reason: `Tidak ditemukan Capaian Pembelajaran untuk ${code} Fase ${phase}${academicYear ? ` pada TA ${academicYear}` : ''}.`,
  };
}

/**
 * Cari Capaian Pembelajaran resmi berdasarkan mata pelajaran dan fase (serta tahun ajaran jika tersedia).
 * Mengembalikan undefined jika tidak ditemukan atau jika terdapat ambiguitas (tidak mengembalikan first match sembarangan).
 */
export function findCPBySubjectAndPhase(
  subjectCodeOrName: string,
  phase: CurriculumPhase,
  academicYear?: string
): MasterCPEntry | undefined {
  const res = resolveCPContext(subjectCodeOrName, phase, academicYear);
  return res.status === 'RESOLVED' && res.cp ? res.cp : undefined;
}

/**
 * Ambil seluruh CP resmi berdasarkan jenjang
 */
export function getCPsByLevel(level: SchoolLevel): MasterCPEntry[] {
  return ALL_MASTER_CP_ENTRIES.filter((cp) => cp.level === level);
}
