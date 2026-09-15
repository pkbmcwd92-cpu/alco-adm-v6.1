import {
  WorkflowStepId,
  CurriculumType,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  AdministrationWorkspace,
  CPData,
  CPAnalysisData,
  TPData,
  TPItem,
  ATPData,
  ATPItem,
  AssessmentCriterion,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  K13Analysis,
  K13KKM,
  ProfileWorkspaceData,
} from '../types';
import { isK13, isMerdeka, getCurriculumTypeFromSetting } from './curriculumRouter';
import { findSubjectByNameOrAlias, findSubjectByCode } from '../data/curriculum/subjects';
import { getPhaseFromGrade } from '../data/curriculumDefaults';

export type WorkflowStatus = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE' | 'STALE';

export interface WorkflowStepState {
  id: WorkflowStepId;
  status: WorkflowStatus;
  isBlocked: boolean;
  isComplete: boolean;
  isStale: boolean;
  reason?: string;
  missingDependencies?: string[];
}

export interface AdministrationContext {
  workspaceId: string;
  teacherProfileId: string;
  schoolId: string;
  academicYear: string;
  semester: 1 | 2;
  curriculumType: CurriculumType;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  grade: number;
  rawGrade: string;
  subjectCode: string;
  subjectName: string;
  phase?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  curriculumResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
}

/**
 * Builds a canonical AdministrationContext from the workspace data.
 * Resolves curriculum status, grade number, phase, and canonical subject code without mutating.
 */
export function buildAdministrationContext(data: {
  workspace?: AdministrationWorkspace;
  profile: TeacherProfile;
  school: SchoolData;
  academicSetting: AcademicSetting;
}): AdministrationContext {
  const { workspace, profile, school, academicSetting } = data;

  const curriculumType: CurriculumType = isK13(academicSetting) ? 'K13' : 'KURIKULUM_MERDEKA';
  const level = (academicSetting.level || profile.defaultLevel || 'SD') as 'SD' | 'SMP' | 'SMA' | 'SMK';
  const rawGrade = academicSetting.grade || 'Kelas 1';
  const gradeNum = parseInt(rawGrade.replace(/[^0-9]/g, ''), 10) || 1;
  const phase = getPhaseFromGrade(level, rawGrade).replace('Fase ', '') as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

  const semVal: 1 | 2 = academicSetting.semester?.startsWith('2') ? 2 : 1;
  const rawSubject = academicSetting.subject || profile.defaultSubject || 'Bahasa Indonesia';

  // Resolve canonical subject code using curriculum master
  const resolvedSubject = findSubjectByNameOrAlias(rawSubject) || findSubjectByCode(rawSubject);
  const subjectCode = resolvedSubject?.code || rawSubject;
  const subjectName = resolvedSubject?.name || rawSubject;
  const curriculumResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' = resolvedSubject ? 'RESOLVED' : 'UNRESOLVED';

  return {
    workspaceId: workspace?.id || `ws-${academicSetting.id}`,
    teacherProfileId: profile.id,
    schoolId: school.id || profile.schoolId || 'sch-default-1',
    academicYear: academicSetting.academicYear || '2025/2026',
    semester: semVal,
    curriculumType,
    level,
    grade: gradeNum,
    rawGrade,
    subjectCode,
    subjectName,
    phase,
    curriculumResolutionStatus,
  };
}

export interface DependencyValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  module: WorkflowStepId | 'KKTP' | 'PERENCANAAN' | 'ASESMEN' | 'TINDAK_LANJUT';
  code: string;
  message: string;
  targetId?: string;
}

export interface DependencyValidationReport {
  isValid: boolean;
  hasErrors: boolean;
  hasStaleModules: boolean;
  issues: DependencyValidationIssue[];
  stepStates: Record<WorkflowStepId, WorkflowStepState>;
}

/**
 * Checks timestamp difference to detect stale upstream dependencies.
 * Returns true if upstream was modified significantly later than downstream's reference timestamp.
 */
export function isUpstreamStale(
  upstreamUpdatedAt?: string,
  downstreamReferenceUpdatedAt?: string,
  thresholdMs: number = 1000
): boolean {
  if (!upstreamUpdatedAt || !downstreamReferenceUpdatedAt) return false;
  const upstreamTime = new Date(upstreamUpdatedAt).getTime();
  const refTime = new Date(downstreamReferenceUpdatedAt).getTime();
  return upstreamTime > refTime + thresholdMs;
}

/**
 * Validates the full workflow dependency graph for a workspace.
 */
export function validateWorkflowDependencies(
  workspaceData: Partial<ProfileWorkspaceData>
): DependencyValidationReport {
  const issues: DependencyValidationIssue[] = [];

  const profile = workspaceData.profile;
  const school = workspaceData.school;
  const academicSetting = workspaceData.academicSetting;
  const cp = workspaceData.cp;
  const cpAnalysis = workspaceData.cpAnalysis;
  const tp = workspaceData.tp;
  const atp = workspaceData.atp;
  const criteria = workspaceData.assessmentCriteria || [];
  const assessments = workspaceData.assessments || [];
  const assessmentResults = workspaceData.assessmentResults || [];
  const remedials = workspaceData.remedials || [];
  const enrichments = workspaceData.enrichments || [];
  const k13Analysis = workspaceData.k13Analysis;
  const k13KKM = workspaceData.k13KKM;

  const isK13Active = academicSetting ? isK13(academicSetting) : false;

  // Step States initial map
  const stepStates: Record<WorkflowStepId, WorkflowStepState> = {
    profile: {
      id: 'profile',
      status: profile?.name?.trim() ? 'COMPLETE' : 'IN_PROGRESS',
      isBlocked: false,
      isComplete: !!profile?.name?.trim(),
      isStale: false,
    },
    academic: {
      id: 'academic',
      status: academicSetting?.subject && academicSetting?.grade ? 'COMPLETE' : 'IN_PROGRESS',
      isBlocked: !profile?.name?.trim(),
      isComplete: !!(academicSetting?.subject && academicSetting?.grade),
      isStale: false,
    },
    cp: { id: 'cp', status: 'READY', isBlocked: false, isComplete: false, isStale: false },
    'cp-analysis': { id: 'cp-analysis', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    tp: { id: 'tp', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    atp: { id: 'atp', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-kd': { id: 'k13-kd', status: 'READY', isBlocked: false, isComplete: false, isStale: false },
    'k13-indikator': { id: 'k13-indikator', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-tujuan': { id: 'k13-tujuan', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    'k13-kkm': { id: 'k13-kkm', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
    admin: { id: 'admin', status: 'BLOCKED', isBlocked: true, isComplete: false, isStale: false },
  };

  // Base Profile & Academic Validation
  if (!profile?.name?.trim()) {
    issues.push({
      severity: 'ERROR',
      module: 'profile',
      code: 'PROFILE_INCOMPLETE',
      message: 'Profil Guru belum lengkap (Nama Guru wajib diisi).',
    });
  }

  if (!academicSetting?.subject || !academicSetting?.grade) {
    issues.push({
      severity: 'ERROR',
      module: 'academic',
      code: 'ACADEMIC_SETTING_INCOMPLETE',
      message: 'Pengaturan Kelas & Mata Pelajaran belum lengkap.',
    });
    stepStates.academic.isBlocked = !stepStates.profile.isComplete;
  }

  if (isK13Active) {
    // ==========================================
    // K13 WORKFLOW VALIDATION
    // ==========================================
    const kdItems = (k13Analysis?.items || []).filter((i) => i.kd && i.kd.trim().length > 0);
    const hasKD = kdItems.length > 0;

    stepStates['k13-kd'] = {
      id: 'k13-kd',
      status: hasKD ? 'COMPLETE' : stepStates.academic.isComplete ? 'READY' : 'BLOCKED',
      isBlocked: !stepStates.academic.isComplete,
      isComplete: hasKD,
      isStale: false,
    };

    const hasAnalisis = hasKD && kdItems.some((i) => (i.materi && i.materi.trim().length > 0) || (i.kegiatan && i.kegiatan.trim().length > 0));
    stepStates['k13-indikator'] = {
      id: 'k13-indikator',
      status: hasAnalisis ? 'COMPLETE' : hasKD ? 'READY' : 'BLOCKED',
      isBlocked: !hasKD,
      isComplete: hasAnalisis,
      isStale: false,
      reason: !hasKD ? 'Memerlukan data SKL/KI/KD terlebih dahulu' : undefined,
    };

    const hasTujuanIndikator = hasAnalisis && kdItems.some((i) => (i.indikator && i.indikator.trim().length > 0) || (i.tujuanPembelajaran && i.tujuanPembelajaran.trim().length > 0));
    stepStates['k13-tujuan'] = {
      id: 'k13-tujuan',
      status: hasTujuanIndikator ? 'COMPLETE' : hasAnalisis ? 'READY' : 'BLOCKED',
      isBlocked: !hasAnalisis,
      isComplete: hasTujuanIndikator,
      isStale: false,
      reason: !hasAnalisis ? 'Memerlukan Analisis KD & Materi terlebih dahulu' : undefined,
    };

    const hasKKM = !!(k13KKM?.items && k13KKM.items.length > 0);
    stepStates['k13-kkm'] = {
      id: 'k13-kkm',
      status: hasKKM ? 'COMPLETE' : hasKD ? 'READY' : 'BLOCKED',
      isBlocked: !hasKD,
      isComplete: hasKKM,
      isStale: false,
    };

    stepStates.admin = {
      id: 'admin',
      status: hasTujuanIndikator ? 'COMPLETE' : 'BLOCKED',
      isBlocked: !hasTujuanIndikator,
      isComplete: hasTujuanIndikator,
      isStale: false,
      reason: !hasTujuanIndikator ? 'Memerlukan Tujuan Pembelajaran & Indikator K13' : undefined,
    };
  } else {
    // ==========================================
    // KURIKULUM MERDEKA WORKFLOW VALIDATION
    // ==========================================

    // 1. CP
    const hasCPText = !!(cp?.generalDescription && cp.generalDescription.trim().length > 10);
    const hasCPElements = !!(cp?.elements && cp.elements.length > 0);
    const isCPComplete = hasCPText || hasCPElements;

    stepStates.cp = {
      id: 'cp',
      status: isCPComplete ? 'COMPLETE' : stepStates.academic.isComplete ? 'READY' : 'BLOCKED',
      isBlocked: !stepStates.academic.isComplete,
      isComplete: isCPComplete,
      isStale: false,
    };

    // 2. CP Analysis (Explicit Dependency of TP)
    const analysisItems = cpAnalysis?.items || [];
    const isAnalysisComplete = isCPComplete && analysisItems.length > 0 && analysisItems.some((i) => (i.cpCompetence?.trim() || i.materialScope?.trim()));
    const isAnalysisStale = isCPComplete && isUpstreamStale(cp?.updatedAt, cpAnalysis?.basedOnCpUpdatedAt);

    stepStates['cp-analysis'] = {
      id: 'cp-analysis',
      status: !isCPComplete
        ? 'BLOCKED'
        : isAnalysisStale
        ? 'STALE'
        : isAnalysisComplete
        ? 'COMPLETE'
        : analysisItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: !isCPComplete,
      isComplete: isAnalysisComplete,
      isStale: isAnalysisStale,
      reason: !isCPComplete ? 'Memerlukan data Capaian Pembelajaran (CP) terlebih dahulu' : isAnalysisStale ? 'Data CP telah diperbarui, analisis CP perlu diselaraskan' : undefined,
      missingDependencies: !isCPComplete ? ['Capaian Pembelajaran (CP)'] : undefined,
    };

    if (!isCPComplete && analysisItems.length > 0) {
      issues.push({
        severity: 'WARNING',
        module: 'cp-analysis',
        code: 'ORPHAN_CP_ANALYSIS',
        message: 'Analisis CP ada tetapi data CP induk belum lengkap.',
      });
    }

    if (isAnalysisStale) {
      issues.push({
        severity: 'INFO',
        module: 'cp-analysis',
        code: 'STALE_CP_ANALYSIS',
        message: 'Capaian Pembelajaran diperbarui setelah Analisis CP dibuat. Tinjau kembali analisis CP.',
      });
    }

    // 3. TP (Tujuan Pembelajaran - Requires CP Analysis)
    const tpItems = tp?.items || [];
    const isTPDataValid = tpItems.length > 0 && tpItems.every((item) => item.statement?.trim().length > 0);
    const isTPStale =
      isAnalysisComplete &&
      (isUpstreamStale(cpAnalysis?.updatedAt, tp?.basedOnAnalysisUpdatedAt) ||
        isUpstreamStale(cp?.updatedAt, tp?.basedOnCpUpdatedAt));

    const isTPBlocked = !isAnalysisComplete;

    stepStates.tp = {
      id: 'tp',
      status: isTPBlocked
        ? 'BLOCKED'
        : isTPStale
        ? 'STALE'
        : isTPDataValid
        ? 'COMPLETE'
        : tpItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: isTPBlocked,
      isComplete: isTPDataValid && !isTPBlocked,
      isStale: isTPStale,
      reason: !isAnalysisComplete
        ? 'Memerlukan Analisis CP terlebih dahulu sebagai rujukan resmi TP'
        : isTPStale
        ? 'Analisis CP telah diperbarui, daftar TP perlu diselaraskan'
        : undefined,
      missingDependencies: !isAnalysisComplete ? ['Analisis CP'] : undefined,
    };

    if (tpItems.length > 0 && !isAnalysisComplete) {
      issues.push({
        severity: 'WARNING',
        module: 'tp',
        code: 'TP_WITHOUT_ANALYSIS',
        message: 'Tujuan Pembelajaran dirumuskan tanpa rujukan Analisis CP yang lengkap.',
      });
    }

    if (isTPStale) {
      issues.push({
        severity: 'INFO',
        module: 'tp',
        code: 'STALE_TP',
        message: 'Analisis CP telah diperbarui. Periksa dan selaraskan rumusan TP.',
      });
    }

    // 4. ATP (Alur Tujuan Pembelajaran - Requires TP and references canonical tpId)
    const atpItems = atp?.items || [];
    const validTpIds = new Set(tpItems.map((t) => t.id));
    const isATPBlocked = !isTPDataValid;

    // Check ATP sequence and orphan tpIds
    let hasOrphanATPItem = false;
    let hasDuplicateATPSequence = false;
    const seenSequences = new Set<number>();

    atpItems.forEach((atpItem) => {
      if (atpItem.tpId && !validTpIds.has(atpItem.tpId)) {
        hasOrphanATPItem = true;
        issues.push({
          severity: 'ERROR',
          module: 'atp',
          code: 'ORPHAN_ATP_TP_ID',
          message: `Item ATP merujuk ke tpId '${atpItem.tpId}' yang tidak ditemukan pada daftar TP canonical.`,
          targetId: atpItem.id,
        });
      }

      const seq = atpItem.stepNumber || atpItem.sequence;
      if (seq) {
        if (seenSequences.has(seq)) {
          hasDuplicateATPSequence = true;
          issues.push({
            severity: 'WARNING',
            module: 'atp',
            code: 'DUPLICATE_ATP_SEQUENCE',
            message: `Duplikasi nomor urut ATP ${seq} terdeteksi.`,
            targetId: atpItem.id,
          });
        }
        seenSequences.add(seq);
      }
    });

    const isATPComplete = isTPDataValid && atpItems.length > 0 && !hasOrphanATPItem;
    const isATPStale = isTPDataValid && isUpstreamStale(tp?.updatedAt, atp?.basedOnTpUpdatedAt);

    stepStates.atp = {
      id: 'atp',
      status: isATPBlocked
        ? 'BLOCKED'
        : isATPStale
        ? 'STALE'
        : isATPComplete
        ? 'COMPLETE'
        : atpItems.length > 0
        ? 'IN_PROGRESS'
        : 'READY',
      isBlocked: isATPBlocked,
      isComplete: isATPComplete,
      isStale: isATPStale,
      reason: isATPBlocked
        ? 'Memerlukan daftar Tujuan Pembelajaran (TP) terlebih dahulu'
        : isATPStale
        ? 'Daftar TP telah diperbarui, alur ATP perlu ditinjau'
        : undefined,
      missingDependencies: isATPBlocked ? ['Tujuan Pembelajaran (TP)'] : undefined,
    };

    if (isATPStale) {
      issues.push({
        severity: 'INFO',
        module: 'atp',
        code: 'STALE_ATP',
        message: 'Tujuan Pembelajaran diperbarui setelah penyusunan ATP. Alur ATP mungkin memerlukan penyesuaian.',
      });
    }

    // 5. KKTP Validation (References canonical tpId)
    criteria.forEach((crit) => {
      if (crit.tpId && !validTpIds.has(crit.tpId)) {
        issues.push({
          severity: 'ERROR',
          module: 'KKTP',
          code: 'ORPHAN_CRITERIA_TP_ID',
          message: `Kriteria KKTP merujuk ke TP '${crit.tpId}' yang tidak terdaftar.`,
          targetId: crit.id,
        });
      }

      if (crit.approach === 'legacy_kkm' && !isK13Active) {
        issues.push({
          severity: 'WARNING',
          module: 'KKTP',
          code: 'LEGACY_KKM_IN_MERDEKA',
          message: 'Pendekatan Legacy KKM tidak direkomendasikan sebagai kriteria utama Kurikulum Merdeka.',
          targetId: crit.id,
        });
      }
    });

    // 6. Administrasi Hub Overall Gating
    stepStates.admin = {
      id: 'admin',
      status: isATPComplete ? 'COMPLETE' : isTPDataValid ? 'IN_PROGRESS' : 'BLOCKED',
      isBlocked: !isTPDataValid,
      isComplete: isATPComplete,
      isStale: isATPStale || isTPStale,
      reason: !isTPDataValid ? 'Memerlukan TP dan Alur ATP untuk modul administrasi lengkap' : undefined,
    };
  }

  const hasErrors = issues.some((i) => i.severity === 'ERROR');
  const hasStaleModules = Object.values(stepStates).some((s) => s.isStale);

  return {
    isValid: !hasErrors,
    hasErrors,
    hasStaleModules,
    issues,
    stepStates,
  };
}

/**
 * Resolves canonical display fields for an ATPItem from canonical TP list.
 * If the ATP item has a valid tpId, canonical statement, code, materialScope, and competence are resolved.
 */
export function resolveATPItemWithTP(
  item: ATPItem,
  tpList: TPItem[]
): {
  item: ATPItem;
  canonicalTP: TPItem | null;
  displayCode: string;
  displayStatement: string;
  displayMaterialScope: string;
  isOrphan: boolean;
} {
  const canonicalTP = tpList.find((t) => t.id === item.tpId) || null;

  if (canonicalTP) {
    return {
      item,
      canonicalTP,
      displayCode: canonicalTP.code || item.tpCode || `TP ${item.stepNumber || 1}`,
      displayStatement: canonicalTP.statement,
      displayMaterialScope: canonicalTP.contentScope || item.materialScope || '-',
      isOrphan: false,
    };
  }

  // Backward compatibility / fallback if tpId is missing or unresolved
  return {
    item,
    canonicalTP: null,
    displayCode: item.tpCode || `TP ${item.stepNumber || 1}`,
    displayStatement: item.tpStatement || '(Tujuan Pembelajaran belum terhubung ke canonical TP)',
    displayMaterialScope: item.materialScope || '-',
    isOrphan: !!item.tpId,
  };
}

/**
 * Resolves canonical TP or KD for an AssessmentCriterion.
 */
export function resolveCriterionTarget(
  criterion: AssessmentCriterion,
  tpList: TPItem[],
  k13Analysis?: K13Analysis
): {
  targetId: string;
  targetCode: string;
  targetStatement: string;
  isOrphan: boolean;
} {
  // Check TP first (Merdeka)
  const matchedTP = tpList.find((t) => t.id === criterion.tpId);
  if (matchedTP) {
    return {
      targetId: matchedTP.id,
      targetCode: matchedTP.code || 'TP',
      targetStatement: matchedTP.statement,
      isOrphan: false,
    };
  }

  // Check K13 KD
  const matchedKD = (k13Analysis?.items || []).find((k) => k.id === criterion.tpId);
  if (matchedKD) {
    return {
      targetId: matchedKD.id,
      targetCode: 'KD',
      targetStatement: matchedKD.kd,
      isOrphan: false,
    };
  }

  return {
    targetId: criterion.tpId || '',
    targetCode: 'UNKNOWN',
    targetStatement: criterion.description || '(Target TP/KD tidak ditemukan)',
    isOrphan: true,
  };
}
