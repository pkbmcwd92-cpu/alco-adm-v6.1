/**
 * Test Suite: PATCH B — Administration Workflow & Dependency Integrity
 */
import {
  validateWorkflowDependencies,
  buildAdministrationContext,
  isUpstreamStale,
  resolveATPItemWithTP,
  resolveCriterionTarget,
} from '../src/services/workflowEngine';
import {
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  AdministrationWorkspace,
  ActiveContext,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  AssessmentCriterion,
} from '../src/types';

console.log('===========================================================');
console.log('🧪 RUNNING TEST SUITE: Workflow & Dependency Foundation (PATCH B)');
console.log('===========================================================');

const mockSchool: SchoolData = {
  id: 'sch-001',
  name: 'SD Negeri Nusantara 01',
  npsn: '12345678',
  address: 'Jl. Merdeka No. 10',
  village: 'Gambir',
  district: 'Gambir',
  regency: 'Jakarta Pusat',
  province: 'DKI Jakarta',
  principalName: 'Dr. H. Ahmad Dahlan, M.Pd.',
  principalNip: '197501012000031001',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockProfile: TeacherProfile = {
  id: 'prof-001',
  name: 'Budi Santoso, S.Pd.',
  nip: '198501012010011005',
  status: 'PNS',
  schoolId: 'sch-001',
  defaultSubject: 'Pendidikan Agama Islam dan Budi Pekerti',
  defaultLevel: 'SD',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockAcademic: AcademicSetting = {
  id: 'acad-001',
  profileId: 'prof-001',
  curriculum: 'Kurikulum Merdeka',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  subject: 'Pendidikan Agama Islam dan Budi Pekerti',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockWorkspace: AdministrationWorkspace = {
  id: 'ws-001',
  profileId: 'prof-001',
  schoolId: 'sch-001',
  academicSettingId: 'acad-001',
  name: 'PAI — Kelas 4 — Semester 1 — 2025/2026',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockActiveContext: ActiveContext = {
  profileId: 'prof-001',
  schoolId: 'sch-001',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  subject: 'Pendidikan Agama Islam dan Budi Pekerti',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
};

// Test 1: AdministrationContext Resolution
console.log('--- 1. Administration Context Resolution ---');
const admContext = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  workspace: mockWorkspace,
});

if (admContext.curriculumType === 'KURIKULUM_MERDEKA' && admContext.grade === 4 && admContext.subjectCode === 'PAI' && admContext.phase === 'B') {
  console.log('✅ AdministrationContext teresolusi dengan canonical subject (PAI), level (SD), grade (4), phase (B)');
} else {
  console.error('❌ Context resolution mismatch', admContext);
  process.exit(1);
}

// Test 2: Dependency Validation when CP is missing
console.log('--- 2. Dependency Validation: CP Missing ---');
const emptyCP: CPData = {
  id: 'cp-001',
  academicSettingId: 'acad-001',
  generalDescription: '',
  elements: [],
  updatedAt: '',
};

const emptyCPAnalysis: CPAnalysisData = {
  id: 'cpa-001',
  academicSettingId: 'acad-001',
  generalSummary: '',
  items: [],
  updatedAt: '',
};

const reportNoCP = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: emptyCP,
  cpAnalysis: emptyCPAnalysis,
});

if (reportNoCP.stepStates['cp-analysis'].isBlocked && reportNoCP.stepStates['tp'].isBlocked && reportNoCP.stepStates['atp'].isBlocked) {
  console.log('✅ CP kosong memblokir Analisis CP, TP, dan ATP secara berantai');
} else {
  console.error('❌ Expected CP to block downstream steps', reportNoCP);
  process.exit(1);
}

// Test 3: CP Analysis required for TP
console.log('--- 3. CP Analysis Hard Dependency for TP ---');
const validCP: CPData = {
  id: 'cp-001',
  academicSettingId: 'acad-001',
  generalDescription: 'Peserta didik memahami rukun iman dan akhlak terpuji.',
  elements: [{ id: 'elem-1', name: 'Akidah', content: 'Memahami makna Asmaul Husna.' }],
  updatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
};

const reportNoAnalysis = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: validCP,
  cpAnalysis: emptyCPAnalysis,
});

if (reportNoAnalysis.stepStates['cp-analysis'].status === 'READY' && reportNoAnalysis.stepStates['tp'].isBlocked) {
  console.log('✅ Analisis CP kosong memblokir tahap TP');
} else {
  console.error('❌ Expected missing CP analysis to block TP', reportNoAnalysis.stepStates);
  process.exit(1);
}

// Test 4: Upstream Stale Detection
console.log('--- 4. Upstream Stale Detection ---');
const validAnalysis: CPAnalysisData = {
  id: 'cpa-001',
  academicSettingId: 'acad-001',
  generalSummary: 'Analisis akidah dan akhlak.',
  items: [{
    id: 'ana-1',
    elementName: 'Akidah',
    cpText: 'Memahami makna Asmaul Husna.',
    cpCompetence: 'Memahami',
    materialScope: 'Asmaul Husna',
    suggestedTp: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    order: 1,
  }],
  basedOnCpUpdatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-03T00:00:00Z').toISOString(),
};

const validTP: TPData = {
  id: 'tp-001',
  academicSettingId: 'acad-001',
  items: [{
    id: 'tp-item-1',
    cpAnalysisId: 'ana-1',
    code: 'TP 4.1',
    elementName: 'Akidah',
    statement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    competence: 'Memahami',
    contentScope: 'Asmaul Husna',
    p3Dimensions: ['Bernalar Kritis'],
    order: 1,
  }],
  basedOnCpUpdatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
  basedOnAnalysisUpdatedAt: new Date('2026-01-03T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-04T00:00:00Z').toISOString(),
};

const validATP: ATPData = {
  id: 'atp-001',
  academicSettingId: 'acad-001',
  rationale: 'Alur disusun secara spiral.',
  items: [{
    id: 'atp-1',
    stepNumber: 1,
    tpId: 'tp-item-1',
    tpCode: 'TP 4.1',
    tpStatement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    materialScope: 'Asmaul Husna',
    jp: 6,
  }],
  basedOnTpUpdatedAt: new Date('2026-01-04T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-05T00:00:00Z').toISOString(),
};

const reportClean = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: validCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  atp: validATP,
});

if (reportClean.isValid && !reportClean.stepStates['tp'].isStale && !reportClean.stepStates['atp'].isStale) {
  console.log('✅ Status alur valid dan sinkron tanpa status STALE');
} else {
  console.error('❌ Expected clean workflow', reportClean);
  process.exit(1);
}

// Simulate CP modification -> downstream becomes STALE
const modifiedCP: CPData = {
  ...validCP,
  updatedAt: new Date('2026-01-10T00:00:00Z').toISOString(),
};

const reportStale = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: modifiedCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  atp: validATP,
});

if (reportStale.stepStates['cp-analysis'].isStale && reportStale.stepStates['tp'].isStale) {
  console.log('✅ Pembaruan pada CP hulu otomatis menandai Analisis CP dan TP sebagai STALE');
} else {
  console.error('❌ Expected STALE detection on downstream modules', reportStale);
  process.exit(1);
}

// Test 5: ATP Resolution with Canonical TP
console.log('--- 5. Canonical ATP Item Resolution ---');
const resolvedItem = resolveATPItemWithTP(validATP.items[0], validTP.items);
if (resolvedItem.canonicalTP && resolvedItem.canonicalTP.id === 'tp-item-1') {
  console.log('✅ ATP item terhubung secara kanonikal ke TP item via tpId');
} else {
  console.error('❌ Failed to resolve canonical TP for ATP item', resolvedItem);
  process.exit(1);
}

// Test 6: KKTP Target Resolution
console.log('--- 6. Canonical KKTP Criterion Resolution ---');
const criterion: AssessmentCriterion = {
  id: 'crit-1',
  academicSettingId: 'acad-001',
  tpId: 'tp-item-1',
  description: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
  approach: 'rubrik',
  indicators: ['Menjelaskan arti Al-Malik'],
  levels: [],
  updatedAt: new Date('2026-01-06T00:00:00Z').toISOString(),
};

const resolvedCrit = resolveCriterionTarget(criterion, validTP.items, undefined);
if (resolvedCrit.targetId === 'tp-item-1' && !resolvedCrit.isOrphan) {
  console.log('✅ KKTP Criterion terhubung ke canonical TP');
} else {
  console.error('❌ Failed to resolve target TP for KKTP criterion', resolvedCrit);
  process.exit(1);
}

console.log('===========================================================');
console.log('🎉 ALL WORKFLOW & DEPENDENCY TESTS (PATCH B) PASSED 100%!');
console.log('===========================================================');
