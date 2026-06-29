'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, HelpCircle, RotateCcw, Wand2, X } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import { visibleSteps, assemblePrompt, surveyToPlan } from '@/lib/survey/assemble';
import { buildFixRequest } from '@/lib/survey/fixes';
import { requestGenerateStream } from '@/lib/client/generate';
import { currentStage, STAGE_ORDER, STAGE_LABEL_EASY, type StreamStage } from '@/lib/ai/streamStages';
import { buildModifyPrompt } from '@/components/creator/prompts';
import PhotoUpload from '@/components/creator/PhotoUpload';
import { playSelect, playSuccess } from '@/lib/client/sound';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import UploadDialog from '@/components/board/UploadDialog';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import BuilderBot from '@/components/ui/BuilderBot';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TypePicker from './TypePicker';
import StepScreen from './StepScreen';
import SurveySummary from './SurveySummary';
import FixPanel from './FixPanel';
import GuideModal from './GuideModal';

const GUIDE_SEEN_KEY = 'easy-guide-seen';

const EMPTY_CODE: GeneratedCode = { html: '', css: '', javascript: '' };

// 수정 후 복귀 지점을 '마지막 만들기 화면'으로 나타내는 센티넬(단계 id와 겹치지 않음)
const FINISH = '__finish__';

export default function SurveyWizard() {
  const [type, setType] = useState<ProgramType | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [editReturn, setEditReturn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buildMsg, setBuildMsg] = useState('AI가 준비하고 있어요…');
  const [stage, setStage] = useState<StreamStage | null>(null);
  const [code, setCode] = useState<GeneratedCode>(EMPTY_CODE);
  // 저장/공유용 프롬프트 — 생성 시 조립 프롬프트로 시작, '고치기'마다 요청을 누적
  const [genPrompt, setGenPrompt] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // 결과 화면 '고치기' — 고른 빠른수정 id들 + 직접 입력문
  const [fixPicks, setFixPicks] = useState<string[]>([]);
  const [fixText, setFixText] = useState('');
  // 가이드 모달 — 첫 방문 자동 + 도움말 버튼 재오픈
  const [guideOpen, setGuideOpen] = useState(false);
  // 로그인 전에 고른 종류 — 로그인 끝나면 이 종류로 자동 진입
  const [pendingType, setPendingType] = useState<ProgramType | null>(null);
  // 생성 화면 사진 1장(학생/교사 전용) — 상태만 보유, 전송 배선은 후속 작업
  const [photo, setPhoto] = useState<string | null>(null);
  // 생성 취소용 — busy 화면에서 '그만 만들기'를 누르면 진행 중 요청을 중단
  const abortRef = useRef<AbortController | null>(null);

  const { user, loading: authLoading, isStudent, isTeacher } = useAuth();
  const { toast } = useToast();

  const steps = useMemo(() => (type ? visibleSteps(type, answers) : []), [type, answers]);
  const hasCode = Boolean(code.html || code.css || code.javascript);
  const onLastDone = stepIdx >= steps.length;

  function enterType(t: ProgramType) {
    setType(t);
    setAnswers({});
    setStepIdx(0);
    setEditReturn(null);
    setCode(EMPTY_CODE);
    setGenPrompt('');
  }
  function pickType(t: ProgramType) {
    // 종류 선택(1번)에서 먼저 로그인 요청 — 끝까지 다 고른 뒤 막혀서 실망하지 않게.
    if (!authLoading && !user) {
      setPendingType(t);
      toast('로그인하면 만들 수 있어요! 먼저 로그인해 주세요.');
      setLoginOpen(true);
      return;
    }
    enterType(t);
  }
  // 첫 방문이면 가이드를 자동으로 한 번 보여준다(이후엔 도움말 버튼으로만)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!localStorage.getItem(GUIDE_SEEN_KEY)) setGuideOpen(true);
    } catch {
      /* localStorage 차단 환경은 그냥 건너뜀 */
    }
  }, []);
  function closeGuide() {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      /* 저장 실패해도 닫기는 동작 */
    }
  }

  // 로그인 다이얼로그에서 로그인에 성공하면, 고르려던 종류로 자동 진입
  useEffect(() => {
    if (user && pendingType) {
      const t = pendingType;
      setPendingType(null);
      setLoginOpen(false);
      enterType(t);
    }
  }, [user, pendingType]);
  function backToTypes() {
    setType(null);
    setAnswers({});
    setStepIdx(0);
    setEditReturn(null);
  }
  function goToStep(i: number) {
    // 요약 칩으로 특정 단계 수정 — 복귀 지점을 '단계 id'(또는 FINISH)로 기억.
    // 인덱스가 아니라 id라, 수정으로 조건부 단계가 생기거나 사라져도 정확히 복귀한다.
    setEditReturn((r) =>
      r !== null ? r : stepIdx >= steps.length ? FINISH : (steps[stepIdx]?.id ?? FINISH),
    );
    setStepIdx(i);
  }
  // 기억한 복귀 지점(단계 id/FINISH)을 주어진 steps 기준 인덱스로 환산
  function returnIndex(forSteps: SurveyStep[]): number {
    if (editReturn === FINISH) return forSteps.length;
    const i = forSteps.findIndex((s) => s.id === editReturn);
    return i === -1 ? forSteps.length : i;
  }
  function isAnswered(step: SurveyStep, ans: SurveyAnswers): boolean {
    const a = ans[step.id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }
  function advance(nextSteps: SurveyStep[], nextAnswers: SurveyAnswers = answers) {
    // 수정 중이었으면 원래 위치로 복귀(새 steps 기준), 아니면 다음 단계
    if (editReturn !== null) {
      const ret = returnIndex(nextSteps);
      // 이 수정으로 새로 노출된(이전엔 없던) 미답 단계가 현재~복귀 지점 사이에 있으면
      // 건너뛰지 말고 거기부터 마저 답하게 한다(조건부 분기를 놓치지 않도록).
      const oldIds = new Set(steps.map((s) => s.id));
      const detour = nextSteps.findIndex(
        (s, i) => i > stepIdx && i < ret && !oldIds.has(s.id) && !isAnswered(s, nextAnswers),
      );
      if (detour !== -1) {
        setStepIdx(detour); // editReturn 유지 — 새 단계까지 답하면 다시 복귀
        return;
      }
      setStepIdx(ret);
      setEditReturn(null);
    } else {
      setStepIdx((i) => i + 1);
    }
  }
  function choose(optionId: string) {
    playSelect();
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
    // 단일: 새 답 기준으로 다음 노출 단계를 계산해 진행/복귀(조건부 분기 즉시 반영)
    const nextAnswers = { ...answers, [step.id]: optionId };
    setAnswers(nextAnswers);
    advance(visibleSteps(type, nextAnswers), nextAnswers);
  }
  function back() {
    if (stepIdx === 0) {
      backToTypes();
      return;
    }
    // 수정 중 뒤로 = 수정 취소하고 원래 위치로 복귀
    if (editReturn !== null) {
      setStepIdx(returnIndex(steps));
      setEditReturn(null);
      return;
    }
    setStepIdx((i) => Math.max(0, i - 1));
  }
  function reset() {
    setType(null);
    setAnswers({});
    setStepIdx(0);
    setEditReturn(null);
    setCode(EMPTY_CODE);
    setGenPrompt('');
    setFixPicks([]);
    setFixText('');
  }

  // 스트리밍 도착 필드 → 저학년용 단계 진행(타이머 아님, 진짜 도착 기반)
  function onStageDelta(p: Partial<{ html: string; css: string; javascript: string }>) {
    const s = currentStage(p);
    if (s) {
      setStage(s);
      setBuildMsg('열심히 만들고 있어요!');
    }
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
    setStage(null);
    setBuildMsg('AI가 준비하고 있어요…');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const prompt = assemblePrompt(type, answers);
      setGenPrompt(prompt);
      const result = await requestGenerateStream(prompt, 'generate', 'survey', {
        signal: ctrl.signal,
        onDelta: onStageDelta,
        photo: photo ?? undefined,
      });
      setCode(result);
      setPreviewKey((k) => k + 1);
      playSuccess();
      toast('우와! 멋진 걸 만들었어요!', 'success');
    } catch (e) {
      // 사용자가 '그만 만들기'로 취소한 경우는 에러 토스트 없이 조용히 설문으로 복귀
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  // 결과 화면 '고치기' — 고른 칩 + 직접 입력문을 합쳐 한 번의 modify 생성으로 반영
  async function handleSurveyModify() {
    if (!type || !hasCode) return;
    if (authLoading) return toast('잠깐만요, 준비 중이에요…');
    if (!user) {
      toast('로그인하면 고칠 수 있어요!');
      setLoginOpen(true);
      return;
    }
    const request = buildFixRequest(fixPicks, fixText);
    if (!request) return toast('고치고 싶은 점을 고르거나 적어 주세요!');

    // 저장/공유 프롬프트에 고치기 요청을 누적(게시물 prompt 한도 대비 클램프)
    setGenPrompt((prev) => `${prev}\n\n[고치기 요청]: ${request}`.slice(-40000));
    setBusy(true);
    setStage(null);
    setBuildMsg('AI가 준비하고 있어요…');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const prompt = buildModifyPrompt(surveyToPlan(type, answers), code, request);
      const result = await requestGenerateStream(prompt, 'modify', 'survey', {
        signal: ctrl.signal,
        onDelta: onStageDelta,
        photo: photo ?? undefined,
      });
      setCode(result);
      setPreviewKey((k) => k + 1);
      setFixPicks([]);
      setFixText('');
      playSuccess();
      toast('원하는 대로 고쳐봤어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '고치다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function toggleFixPick(id: string) {
    setFixPicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // busy 화면에서 '그만 만들기' — 진행 중 생성 요청을 중단하고 설문으로 복귀
  function cancelGenerate() {
    abortRef.current?.abort();
  }

  // '나머지는 AI가 알아서!' — 남은(안 답한) 단일선택 단계를 AI에게 위임하고 만들기 화면으로
  function aiFillRest() {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const s of steps) {
        if (!s.multi && !next[s.id]) next[s.id] = AI_PICK;
      }
      return next;
    });
    setEditReturn(null);
    setStepIdx(steps.length);
  }

  // 결과 화면 — 단, 고치는 중(busy)이면 건너뛰고 아래 busy 화면을 보여준다.
  // (modify는 hasCode가 이미 true라, !busy 가드 없으면 로딩 피드백이 안 떠 '안 눌린 것'처럼 보임)
  if (hasCode && type && !busy) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="anim-pop-tada text-[22px]">{type.icon} {type.label} 완성!</h2>
          <div className="flex gap-2">
            <Button variant="soft" onClick={reset}>
              <RotateCcw size={17} aria-hidden /> 새로 만들기
            </Button>
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              자랑하기
            </Button>
          </div>
        </div>
        <FullscreenFrame
          frameKey={previewKey}
          code={code}
          photo={photo ?? undefined}
          title={type.label}
          className="h-[78vh] w-full overflow-hidden rounded-[var(--r-md)] border-2 border-line"
        />
        <FixPanel
          picks={fixPicks}
          onTogglePick={toggleFixPick}
          text={fixText}
          onTextChange={setFixText}
          onFix={handleSurveyModify}
        />
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          code={code}
          plan={surveyToPlan(type, answers)}
          prompt={genPrompt || assemblePrompt(type, answers)}
          defaultTitle={type.buildName(answers)}
          photo={photo ?? undefined}
        />
      </div>
    );
  }

  // 생성 중 — 로봇 + 메시지 + 고른 것
  if (busy && type) {
    return (
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[260px_1fr]">
        <div className="order-2 lg:order-1">
          <SurveySummary type={type} steps={steps} answers={answers} />
        </div>
        <div className="order-1 grid min-h-[50vh] place-items-center lg:order-2">
          <div className="flex flex-col items-center gap-5 text-center">
            <BuilderBot />
            {/* 스크린리더용 단계 안내(시각 요소는 아래 체크리스트) */}
            <p className="sr-only" role="status" aria-live="polite">
              {stage ? `${STAGE_LABEL_EASY[stage]} 만들고 있어요` : 'AI가 준비하고 있어요'}
            </p>
            <p className="text-[18px] text-muted" aria-hidden="true">
              {buildMsg}
            </p>
            {/* 3단계 체크리스트 — 도착한 단계만큼 체크(진짜 진행 기반). 시각용이라 SR에선 숨김 */}
            <ul className="flex flex-col gap-2.5 text-left" aria-hidden="true">
              {STAGE_ORDER.map((s) => {
                const cur = stage ? STAGE_ORDER.indexOf(stage) : -1;
                const done = cur > STAGE_ORDER.indexOf(s);
                const active = stage === s;
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-3 text-[17px] ${
                      active ? 'font-medium text-ink' : done ? 'text-muted' : 'text-muted/55'
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                        done
                          ? 'border-brand bg-brand text-brand-ink'
                          : active
                            ? 'border-brand text-brand'
                            : 'border-line'
                      }`}
                    >
                      {done ? (
                        <Check size={16} aria-hidden />
                      ) : active ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-brand motion-safe:animate-pulse" />
                      ) : null}
                    </span>
                    {STAGE_LABEL_EASY[s]}
                  </li>
                );
              })}
            </ul>
            <Button variant="soft" onClick={cancelGenerate}>
              <X size={17} aria-hidden /> 그만 만들기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 종류 선택
  if (!type) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setGuideOpen(true)}
            className="press inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 py-2 text-[14.5px] text-muted hover:border-brand/50 hover:text-brand-strong dark:hover:text-brand"
          >
            <HelpCircle size={17} aria-hidden /> 어떻게 만들어요?
          </button>
        </div>
        {!authLoading && !user && (
          <button
            onClick={() => setLoginOpen(true)}
            className="press anim-pop-in mb-5 flex w-full items-center justify-center gap-2 rounded-[var(--r-lg)] border-2 border-brand/40 bg-brand-soft px-4 py-3 text-[15.5px] font-medium text-brand-strong dark:text-brand"
          >
            🔑 로그인하면 바로 만들 수 있어요 — 먼저 로그인할까요?
          </button>
        )}
        <TypePicker types={PROGRAM_TYPES} onPick={pickType} />
        <LoginDialog
          open={loginOpen}
          onClose={() => {
            setLoginOpen(false);
            setPendingType(null);
          }}
        />
        <GuideModal open={guideOpen} onClose={closeGuide} />
      </div>
    );
  }

  // 단계 진행 — 좌측 요약(수정 가능) + 우측 단계
  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
        <SurveySummary
          type={type}
          steps={steps}
          answers={answers}
          currentStepId={onLastDone ? undefined : steps[stepIdx]?.id}
          onEditType={backToTypes}
          onEditStep={goToStep}
        />
      </aside>

      <div className="order-1 flex flex-col gap-5 lg:order-2">
        <button
          onClick={back}
          className="press inline-flex w-fit items-center gap-1 text-[15px] text-muted hover:text-ink"
        >
          <ArrowLeft size={18} aria-hidden /> 뒤로
        </button>

        {onLastDone ? (
          <div className="anim-pop-in text-center">
            <h2 className="text-[24px]">다 골랐어요! 만들어 볼까요?</h2>
            <p className="mt-1 text-[16px] text-muted">고른 대로 AI가 만들어 줄 거예요</p>
            {(isStudent || isTeacher) && (
              <div className="mt-5 flex justify-center">
                <PhotoUpload value={photo} onChange={setPhoto} />
              </div>
            )}
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
              <Button variant="primary" onClick={() => advance(steps)} className="w-fit self-end">
                다음
              </Button>
            )}
            <button
              onClick={aiFillRest}
              className="press inline-flex w-fit items-center gap-1.5 self-center rounded-full border-2 border-dashed border-line px-4 py-2 text-[14.5px] text-muted hover:border-brand/50 hover:text-brand-strong dark:hover:text-brand"
            >
              🤖 나머지는 AI가 알아서 만들어줘!
            </button>
          </>
        )}
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
