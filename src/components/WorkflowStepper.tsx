import React from 'react';
import {
  User,
  SlidersHorizontal,
  FileSpreadsheet,
  Target,
  GitMerge,
  FileCheck2,
  CheckCircle2,
  Lock,
  School,
  FolderTree,
  Brain,
  BookOpen,
  ListChecks,
  Calculator,
} from 'lucide-react';
import {
  WorkflowStepId,
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  CPData,
  TPData,
  ATPData,
  AdministrationWorkspace,
  CPAnalysisData,
  K13Analysis,
  K13KKM,
} from '../types';
import { getCurriculumTypeFromSetting, isK13 } from '../services/curriculumRouter';

interface WorkflowStepperProps {
  currentStep: WorkflowStepId;
  onSelectStep: (step: WorkflowStepId) => void;
  profile: TeacherProfile;
  school: SchoolData;
  workspace?: AdministrationWorkspace;
  academicSetting: AcademicSetting;
  cp: CPData;
  cpAnalysis?: CPAnalysisData;
  tp: TPData;
  atp: ATPData;
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  onSelectStep,
  profile,
  school,
  workspace,
  academicSetting,
  cp,
  cpAnalysis,
  tp,
  atp,
  k13Analysis,
  k13KKM,
}) => {
  const curriculumType = getCurriculumTypeFromSetting(academicSetting);
  const isK13Active = isK13(academicSetting);

  // Common steps completion
  const isProfileComplete = !!(profile?.name && profile.name.trim().length > 0);
  const isAcademicComplete = !!(academicSetting?.subject && academicSetting?.grade);

  // Merdeka steps completion & gating
  const isCPComplete = !!(
    (cp?.generalDescription && cp.generalDescription.trim().length > 10) ||
    (cp?.elements && cp.elements.length > 0)
  );
  const isCPAnalysisComplete = !!(cpAnalysis?.items && cpAnalysis.items.length > 0);
  const isTPComplete = !!(tp?.items && tp.items.length > 0);
  const isATPComplete = !!(atp?.items && atp.items.length > 0);

  // K13 steps completion & gating
  const hasK13KD = !!(
    k13Analysis?.items &&
    k13Analysis.items.length > 0 &&
    k13Analysis.items.some((i) => i.kd && i.kd.trim().length > 0)
  );
  const hasK13Analisis = !!(
    hasK13KD &&
    k13Analysis?.items &&
    k13Analysis.items.some(
      (i) => (i.materi && i.materi.trim().length > 0) || (i.kegiatan && i.kegiatan.trim().length > 0)
    )
  );
  const hasK13TujuanIndikator = !!(
    hasK13Analisis &&
    k13Analysis?.items &&
    k13Analysis.items.some(
      (i) =>
        (i.indikator && i.indikator.trim().length > 0) ||
        (i.tujuanPembelajaran && i.tujuanPembelajaran.trim().length > 0)
    )
  );

  // Build steps list depending on curriculum
  type StepItem = {
    id: WorkflowStepId;
    num: string;
    title: string;
    sub: string;
    icon: React.ReactNode;
    isComplete: boolean;
    isLocked: boolean;
    lockReason?: string;
  };

  const steps: StepItem[] = isK13Active
    ? [
        {
          id: 'profile',
          num: '01',
          title: 'PROFIL',
          sub: 'Guru & Sekolah',
          icon: <User className="w-4 h-4" />,
          isComplete: isProfileComplete,
          isLocked: false,
        },
        {
          id: 'academic',
          num: '02',
          title: 'DATA PEMBELAJARAN',
          sub: 'Kelas, Mapel & JP',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          isComplete: isAcademicComplete,
          isLocked: false,
        },
        {
          id: 'k13-kd',
          num: '03',
          title: 'SKL / KI / KD',
          sub: 'Kompetensi Dasar',
          icon: <BookOpen className="w-4 h-4" />,
          isComplete: hasK13KD,
          isLocked: false,
        },
        {
          id: 'k13-indikator',
          num: '04',
          title: 'ANALISIS KD',
          sub: 'Telaah & Materi Pokok',
          icon: <ListChecks className="w-4 h-4" />,
          isComplete: hasK13Analisis,
          isLocked: !hasK13KD,
          lockReason: 'Memerlukan data SKL/KI/KD terlebih dahulu',
        },
        {
          id: 'k13-tujuan',
          num: '05',
          title: 'TUJUAN & INDIKATOR',
          sub: 'Tujuan Pembelajaran & IPK',
          icon: <Calculator className="w-4 h-4" />,
          isComplete: hasK13TujuanIndikator,
          isLocked: !hasK13Analisis,
          lockReason: 'Memerlukan Analisis KD & Materi terlebih dahulu',
        },
        {
          id: 'admin',
          num: '06',
          title: 'ADMINISTRASI',
          sub: 'Perencanaan & Nilai',
          icon: <FileCheck2 className="w-4 h-4" />,
          isComplete: hasK13TujuanIndikator,
          isLocked: !hasK13TujuanIndikator,
          lockReason: 'Memerlukan Tujuan Pembelajaran / Indikator terlebih dahulu',
        },
      ]
    : [
        {
          id: 'profile',
          num: '01',
          title: 'PROFIL',
          sub: 'Guru & Sekolah',
          icon: <User className="w-4 h-4" />,
          isComplete: isProfileComplete,
          isLocked: false,
        },
        {
          id: 'academic',
          num: '02',
          title: 'DATA PEMBELAJARAN',
          sub: 'Kelas, Fase, Mapel',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          isComplete: isAcademicComplete,
          isLocked: false,
        },
        {
          id: 'cp',
          num: '03',
          title: 'CP',
          sub: 'Capaian Pembelajaran',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          isComplete: isCPComplete,
          isLocked: false,
        },
        {
          id: 'cp-analysis',
          num: '04',
          title: 'ANALISIS CP',
          sub: 'Bedah Kompetensi',
          icon: <Brain className="w-4 h-4" />,
          isComplete: isCPAnalysisComplete,
          isLocked: !isCPComplete,
          lockReason: 'Memerlukan data CP terlebih dahulu',
        },
        {
          id: 'tp',
          num: '05',
          title: 'TP',
          sub: 'Tujuan Pembelajaran',
          icon: <Target className="w-4 h-4" />,
          isComplete: isTPComplete,
          isLocked: !isCPComplete,
          lockReason: 'Memerlukan data CP terlebih dahulu',
        },
        {
          id: 'atp',
          num: '06',
          title: 'ATP',
          sub: 'Alur Tujuan & JP',
          icon: <GitMerge className="w-4 h-4" />,
          isComplete: isATPComplete,
          isLocked: !isTPComplete,
          lockReason: 'Memerlukan daftar TP terlebih dahulu',
        },
        {
          id: 'admin',
          num: '07',
          title: 'ADMINISTRASI',
          sub: 'Asesmen & Dokumen',
          icon: <FileCheck2 className="w-4 h-4" />,
          isComplete: isATPComplete,
          isLocked: !isATPComplete,
          lockReason: 'Memerlukan susunan ATP terlebih dahulu',
        },
      ];

  return (
    <div className="space-y-4">
      {/* Profil Aktif & Konteks Pembelajaran Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Profil: {profile.name}
              </span>
              {workspace && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <FolderTree className="w-3 h-3 text-emerald-400" />
                  {workspace.name}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{academicSetting.subject || 'Mata Pelajaran'}</span>
              <span className="text-slate-400 font-normal text-sm">
                • {academicSetting.grade}
                {!isK13Active && academicSetting.phase ? ` (${academicSetting.phase})` : ''}
              </span>
            </h2>
            <p className="text-xs text-blue-200 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{school.name || 'Satuan Pendidikan'}</span>
              {school.district && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">{school.district}</span>
                </>
              )}
            </p>
          </div>

          {/* Right contextual chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 lg:pt-0 border-t border-slate-800/80 lg:border-t-0">
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mata Pelajaran</span>
              <span className="text-xs font-bold text-white truncate block" title={academicSetting.subject}>
                {academicSetting.subject || '-'}
              </span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                {isK13Active ? 'Tingkat / Kelas' : 'Kelas & Fase'}
              </span>
              <span className="text-xs font-bold text-blue-300 truncate block">
                {isK13Active
                  ? academicSetting.grade
                  : `${academicSetting.grade} • ${academicSetting.phase}`}
              </span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tahun Ajaran</span>
              <span className="text-xs font-bold text-white truncate block">
                {academicSetting.academicYear} (Sem {academicSetting.semester?.startsWith('1') ? '1' : '2'})
              </span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Kurikulum</span>
              <span className="text-xs font-bold text-emerald-400 truncate block">
                {academicSetting.curriculum}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Navigation Bar */}
      <nav aria-label="Alur Kerja Administrasi" className="bg-white rounded-2xl p-2 sm:p-3 border border-slate-200/80 shadow-xs">
        <div className={`grid grid-cols-2 md:grid-cols-3 ${isK13Active ? 'lg:grid-cols-6' : 'lg:grid-cols-7'} gap-2`}>
          {steps.map((step) => {
            const isActive = currentStep === step.id;

            return (
              <button
                key={step.id}
                id={`btn-step-${step.id}`}
                disabled={step.isLocked}
                onClick={() => onSelectStep(step.id)}
                title={step.isLocked ? step.lockReason : `Buka tahap ${step.num}: ${step.title}`}
                className={`relative flex flex-col items-start p-3 rounded-xl text-left transition-all duration-150 select-none ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-md shadow-blue-900/15 ring-2 ring-blue-700'
                    : step.isLocked
                    ? 'bg-slate-50 text-slate-400 border border-slate-200/50 cursor-not-allowed opacity-75'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 cursor-pointer'
                }`}
              >
                {/* Step Top row with Number & Status icon */}
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-blue-800 text-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span className={isActive ? 'text-blue-300' : 'text-slate-500'}>
                      {step.icon}
                    </span>
                  </div>

                  <div>
                    {step.isComplete ? (
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          isActive ? 'text-emerald-300' : 'text-emerald-600'
                        }`}
                        title="Tahap telah terisi"
                      />
                    ) : step.isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" title={step.lockReason} />
                    ) : (
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 ${
                          isActive
                            ? 'border-blue-300 bg-transparent'
                            : 'border-slate-300 bg-transparent'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Step Title & Sub */}
                <div className="w-full">
                  <div
                    className={`text-xs font-bold tracking-tight truncate ${
                      isActive ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      isActive ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    {step.sub}
                  </div>
                </div>

                {/* Step bottom progress indicator bar */}
                <div
                  className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full ${
                    isActive
                      ? 'bg-blue-400'
                      : step.isComplete
                      ? 'bg-emerald-500'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
