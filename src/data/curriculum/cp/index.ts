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
 * Helper to parse starting integer year from academic year string, e.g. "2025/2026" -> 2025
 */
export function parseAcademicYearStart(ay?: string | null): number | null {
  if (!ay) return null;
  const match = ay.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Memeriksa apakah suatu tahun ajaran target masuk dalam masa berlaku CP.
 * Menggunakan semantik murni tahun ajaran (academic year range) tanpa konversi tanggal sintetis (seperti 1 Juli).
 */
export function isCPApplicableForAcademicYear(
  cp: MasterCPEntry,
  targetAcademicYear: string
): boolean {
  const targetYear = parseAcademicYearStart(targetAcademicYear);
  if (targetYear === null) return false;

  // 1. Cek batas awal tahun ajaran implementasi
  if (cp.implementationFromAcademicYear) {
    const fromYear = parseAcademicYearStart(cp.implementationFromAcademicYear);
    if (fromYear !== null && targetYear < fromYear) {
      return false;
    }
  } else if (cp.effectiveFrom) {
    const fromYear = parseInt(cp.effectiveFrom.slice(0, 4), 10);
    if (!isNaN(fromYear) && targetYear < fromYear) {
      return false;
    }
  }

  // 2. Cek batas akhir tahun ajaran implementasi (jika null, berarti berlaku terus/open-ended hingga digantikan)
  if (cp.implementationUntilAcademicYear) {
    const untilYear = parseAcademicYearStart(cp.implementationUntilAcademicYear);
    if (untilYear !== null && targetYear > untilYear) {
      return false;
    }
  } else if (cp.effectiveUntil) {
    const untilYear = parseInt(cp.effectiveUntil.slice(0, 4), 10);
    if (!isNaN(untilYear)) {
      const isMidYearOrEarly = cp.effectiveUntil.slice(5) <= '06-30';
      const maxApplicableStartYear = isMidYearOrEarly ? untilYear - 1 : untilYear;
      if (targetYear > maxApplicableStartYear) {
        return false;
      }
    }
  }

  return true;
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
    candidates = baseCandidates.filter((cp) => {
      return isCPApplicableForAcademicYear(cp, academicYear);
    });
  } else {
    // Tanpa filter tahun ajaran spesifik: utamakan kandidat yang aktif dan open-ended
    const openEnded = baseCandidates.filter(
      (c) => c.verificationStatus !== 'SUPERSEDED' && !c.implementationUntilAcademicYear
    );
    if (openEnded.length === 1) {
      candidates = openEnded;
    } else if (openEnded.length > 1) {
      candidates = openEnded;
    } else {
      candidates = baseCandidates.filter((c) => c.verificationStatus !== 'SUPERSEDED');
    }
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
