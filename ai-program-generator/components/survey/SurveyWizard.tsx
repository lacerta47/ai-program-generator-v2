'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Wand2 } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import type { ProgramType, SurveyAnswers } from '@/lib/survey/types';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import { visibleSteps, assemblePrompt, surveyToPlan } from '@/lib/survey/assemble';
import { requestGenerate } from '@/lib/client/generate';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import UploadDialog from '@/components/board/UploadDialog';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TypePicker from './TypePicker';
import StepScreen from './StepScreen';
import SurveySummary from './SurveySummary';

const EMPTY_CODE: GeneratedCode = { html: '', css: '', javascript: '' };

export default function SurveyWizard() {
  const [type, setType] = useState<ProgramType | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<GeneratedCode>(EMPTY_CODE);
  const [previewKey, setPreviewKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const steps = useMemo(() => (type ? visibleSteps(type, answers) : []), [type, answers]);
  const hasCode = Boolean(code.html || code.css || code.javascript);

  function pickType(t: ProgramType) {
    setType(t);
    setAnswers({});
    setStepIdx(0);
    setCode(EMPTY_CODE);
  }

  function choose(optionId: string) {
    if (!type) return;
    const step = steps[stepIdx];
    if (step.multi) {
      // 다중: 토글, 자동 진행 안 함
      setAnswers((prev) => {
        const cur = Array.isArray(prev[step.id]) ? (prev[step.id] as string[]) : [];
        const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
        return { ...prev, [step.id]: next };
      });
      return;
    }
    // 단일: 선택 후 다음 단계로
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
    setStepIdx((i) => i + 1);
  }

  function back() {
    if (stepIdx === 0) {
      setType(null);
      return;
    }
    setStepIdx((i) => Math.max(0, i - 1));
  }

  function reset() {
    setType(null);
    setAnswers({});
    setStepIdx(0);
    setCode(EMPTY_CODE);
  }

  async function generate() {
    if (!type) return;
    if (authLoading) return toast('잠깐만요, 준비 중이에요…');
    if (!user) {
      toast('로그인하면 만들 수 있어요!');
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      const prompt = assemblePrompt(type, answers);
      const result = await requestGenerate(prompt, 'generate', 'survey');
      setCode(result);
      setPreviewKey((k) => k + 1);
      toast('우와! 멋진 걸 만들었어요!', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
    } finally {
      setBusy(false);
    }
  }

  // 결과 화면
  if (hasCode && type) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px]">{type.icon} {type.label} 완성!</h2>
          <div className="flex gap-2">
            <Button variant="soft" onClick={reset}><RotateCcw size={17} aria-hidden /> 새로 만들기</Button>
            <Button variant="primary" onClick={() => (user ? setUploadOpen(true) : setLoginOpen(true))}>
              자랑하기
            </Button>
          </div>
        </div>
        <FullscreenFrame
          frameKey={previewKey}
          code={code}
          title={type.label}
          className="min-h-[70vh] w-full overflow-hidden rounded-[var(--r-md)] border-2 border-line"
        />
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          code={code}
          plan={surveyToPlan(type, answers)}
          prompt={assemblePrompt(type, answers)}
          defaultTitle={type.buildName(answers)}
        />
      </div>
    );
  }

  // 생성 중
  if (busy) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoadingDots label="고른 대로 만드는 중…" />
      </div>
    );
  }

  // 종류 선택
  if (!type) {
    return (
      <div className="mx-auto max-w-2xl">
        <TypePicker types={PROGRAM_TYPES} onPick={pickType} />
      </div>
    );
  }

  // 단계 진행 또는 "만들기"
  const onLastDone = stepIdx >= steps.length;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <button onClick={back} className="press inline-flex w-fit items-center gap-1 text-[15px] text-muted hover:text-ink">
        <ArrowLeft size={18} aria-hidden /> 뒤로
      </button>

      {onLastDone ? (
        <div className="anim-pop-in text-center">
          <h2 className="text-[24px]">다 골랐어요! 만들어 볼까요?</h2>
          <p className="mt-1 text-[16px] text-muted">고른 대로 AI가 만들어 줄 거예요</p>
          <Button variant="primary" size="lg" onClick={generate} className="mt-6">
            <Wand2 size={21} aria-hidden /> 만들기!
          </Button>
        </div>
      ) : (
        <>
          <StepScreen
            step={steps[stepIdx]}
            index={stepIdx}
            total={steps.length}
            value={answers[steps[stepIdx].id]}
            onChoose={choose}
          />
          {steps[stepIdx].multi && (
            <Button variant="primary" onClick={() => setStepIdx((i) => i + 1)} className="w-fit self-end">
              다음
            </Button>
          )}
        </>
      )}

      <SurveySummary type={type} steps={steps} answers={answers} />
    </div>
  );
}
