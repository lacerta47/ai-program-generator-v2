'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Lightbulb, Pencil } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import { type PlanFields, EMPTY_PLAN } from '@/lib/firebase/types';
import { requestGenerateStream } from '@/lib/client/generate';
import { updatePostContent } from '@/lib/firebase/posts';
import { ProfanityError } from '@/lib/moderation';
import { downloadProgram } from '@/lib/client/postActions';
import { EXAMPLE_PLANS } from '@/lib/examples';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import UploadDialog from '@/components/board/UploadDialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip, { CHIP_COLORS } from '@/components/ui/Chip';
import { TextInput, TextArea, Label } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { playSuccess } from '@/lib/client/sound';
import { buildGeneratePrompt, buildModifyPrompt } from './prompts';
import { useCreatorSource } from './useCreatorSource';
import { Tip } from './Tip';
import ResultPanel from './ResultPanel';
import PhotoUpload from './PhotoUpload';

type ResultTab = 'preview' | 'code';

const EMPTY_CODE: GeneratedCode = { html: '', css: '', javascript: '' };
const DRAFT_KEY = 'lun:create-draft';

export default function Creator() {
  const [plan, setPlan] = useState<PlanFields>(EMPTY_PLAN);
  const [code, setCode] = useState<GeneratedCode>(EMPTY_CODE);
  const [loading, setLoading] = useState<'idle' | 'generating' | 'modifying'>('idle');
  const [streamingPartial, setStreamingPartial] = useState<Partial<GeneratedCode>>({});
  const [resultTab, setResultTab] = useState<ResultTab>('preview');
  const [modifyText, setModifyText] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [genPrompt, setGenPrompt] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const { user, loading: authLoading, isStudent, isTeacher } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const modifyRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasCode = Boolean(code.html || code.css || code.javascript);
  const busy = loading !== 'idle';

  // ?edit= / ?fork= URL 소스 로딩은 훅으로 분리(불러온 값만 받아 생성 상태에 반영).
  const applyLoaded = (d: { plan: PlanFields; code: GeneratedCode; genPrompt: string; photo: string | null }) => {
    setPlan(d.plan);
    setCode(d.code);
    setGenPrompt(d.genPrompt);
    setPhoto(d.photo);
    setResultTab('preview');
    setPreviewKey((k) => k + 1);
  };
  const { editing, forkSource, clearSource } = useCreatorSource(applyLoaded);

  // 만들기 폼 임시저장(새로 만들 때만 — 편집/이어만들기는 실제 내용을 불러오므로 제외).
  // 새로고침·실수로 나가도 계획서가 사라지지 않게 localStorage에 보관하고, 다음 방문 시 조용히 복원.
  const draftMode = () => {
    const p = new URLSearchParams(window.location.search);
    return !p.get('edit') && !p.get('fork');
  };
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    if (!draftMode()) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<PlanFields>;
      if (Object.values(saved).some((v) => typeof v === 'string' && v.trim())) {
        setPlan({ ...EMPTY_PLAN, ...saved });
        toast('이어서 작성할 수 있어요');
      }
    } catch {}
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftMode()) return;
    const has = Object.values(plan).some((v) => v.trim());
    const t = setTimeout(() => {
      try {
        if (has) localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
        else localStorage.removeItem(DRAFT_KEY);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updatePostContent(editing.id, {
        title: editing.title,
        authorName: editing.authorName || '익명',
        plan,
        code,
        prompt: genPrompt,
        updatedAt: Date.now(),
      });
      toast('작품을 고쳐서 저장했어요!', 'success');
      router.push(`/board?post=${editing.id}`);
    } catch (e) {
      console.error('작품 수정 저장 실패:', e);
      if (e instanceof ProfanityError) {
        toast(e.message);
      } else {
        toast('저장하지 못했어요. 인터넷 연결이나 권한을 확인해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  }

  const setField = (key: keyof PlanFields, value: string) =>
    setPlan((prev) => ({ ...prev, [key]: value }));

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleGenerate() {
    if (authLoading) {
      toast('잠깐만요, 준비 중이에요…');
      return;
    }
    if (!user) {
      toast('로그인하면 프로그램을 만들 수 있어요!');
      setLoginOpen(true);
      return;
    }
    if (!plan.name.trim()) {
      toast('프로그램 이름을 먼저 적어 주세요!');
      nameRef.current?.focus();
      return;
    }
    const promptText = buildGeneratePrompt(plan);
    setGenPrompt(promptText);
    setStreamingPartial({});
    setResultTab('code'); // 스트림 중 코드 탭에서 라이브 표시
    setLoading('generating');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await requestGenerateStream(promptText, 'generate', 'default', {
        signal: ctrl.signal,
        onDelta: setStreamingPartial,
        photo: photo ?? undefined,
      });
      setCode(result);
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
      playSuccess();
      toast('우와! 멋진 프로그램을 완성했어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setStreamingPartial({});
      setLoading('idle');
      // 취소/실패로 코드 탭에 남지 않게 — 결과(미리보기)로 복귀(코드 없으면 빈 화면이 자연히 노출)
      setResultTab('preview');
    }
  }

  async function handleModify() {
    if (authLoading) {
      toast('잠깐만요, 준비 중이에요…');
      return;
    }
    if (!user) {
      toast('로그인하면 프로그램을 고칠 수 있어요!');
      setLoginOpen(true);
      return;
    }
    if (!modifyText.trim()) {
      toast('바꾸고 싶은 점을 먼저 적어 주세요!');
      modifyRef.current?.focus();
      return;
    }
    setLoading('modifying');
    // 수정 이력을 누적하되, 게시물 prompt 필드 한도(50,000자, firestore.rules)를 넘지 않게 클램프
    setGenPrompt((prev) => `${prev}\n\n[수정 요청]: ${modifyText}`.slice(-40000));
    setStreamingPartial({});
    setResultTab('code');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await requestGenerateStream(buildModifyPrompt(plan, code, modifyText), 'modify', 'default', {
        signal: ctrl.signal,
        onDelta: setStreamingPartial,
        photo: photo ?? undefined,
      });
      setCode(result);
      setModifyText('');
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
      playSuccess();
      toast('원하는 대로 고쳐봤어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '고치다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setStreamingPartial({});
      setLoading('idle');
      // 취소/실패 시 보던 미리보기로 복귀(수정 전 결과 보존)
      setResultTab('preview');
    }
  }

  function applyExample() {
    const ex = EXAMPLE_PLANS[exampleIndex];
    setPlan({ name: ex.name, look: ex.look, usage: ex.usage, how: ex.how, etc: ex.etc });
  }

  function handleDownload() {
    downloadProgram(code, editing?.title || plan.name || '내작품', toast, photo ?? undefined);
  }

  function handleReset() {
    setPlan(EMPTY_PLAN);
    setCode(EMPTY_CODE);
    setModifyText('');
    setGenPrompt('');
    setResultTab('preview');
    clearSource();
    nameRef.current?.focus();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(360px,5fr)_7fr]">
      {editing && (
        <div className="anim-pop-in flex items-center gap-2 rounded-[var(--r-md)] border-2 border-brand/40 bg-brand-soft px-4 py-2.5 text-[15px] text-brand-strong lg:col-span-2 dark:text-brand">
          <Pencil size={16} aria-hidden />
          <span className="truncate">
            <strong>{editing.title}</strong> 작품을 고치는 중이에요. 다 고치면 <strong>수정 저장</strong>을 눌러요.
          </span>
        </div>
      )}
      {/* 왼쪽: 계획서 */}
      <Card animate className="flex flex-col gap-4 self-start">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-brand-soft text-brand-strong dark:text-brand">
            <Lightbulb size={20} aria-hidden />
          </span>
          <h2 className="text-[25px]">어떤 프로그램을 만들까요?</h2>
        </div>

        <Label
          text="프로그램 이름"
          required
          tip={<Tip lead="무엇을 하는 프로그램인지 한눈에 보이게 짧게 지어요." examples={['구구단 퀴즈 게임', '움직이는 강아지 그림판', '나만의 비밀 일기장']} />}
        >
          <TextInput
            ref={nameRef}
            value={plan.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="예: 간단한 메모장"
            maxLength={2000}
          />
        </Label>
        <Label
          text="어떻게 생겼나요? (색깔, 모양)"
          tip={<Tip lead="색깔·모양·크기를 자세히 말할수록 상상한 모습과 비슷하게 나와요." examples={['배경은 하늘색, 버튼은 크고 노란색', '글자는 굵게, 옛날 픽셀 게임 느낌으로']} />}
        >
          <TextArea
            value={plan.look}
            onChange={(e) => setField('look', e.target.value)}
            placeholder="예: 어두운 배경에 파란 저장 버튼"
            maxLength={5000}
          />
        </Label>
        <Label
          text="어떻게 사용하나요?"
          tip={<Tip lead="사용하는 순서대로 차근차근 알려줘요. 누르고, 쓰고, 고르는 방법!" examples={['답을 쓰고 확인 버튼을 눌러요', '키보드 화살표로 캐릭터를 움직여요']} />}
        >
          <TextArea
            value={plan.usage}
            onChange={(e) => setField('usage', e.target.value)}
            placeholder="예: 글을 쓰고 저장 버튼을 누르면 목록에 추가돼요"
            maxLength={5000}
          />
        </Label>
        <Label
          text="어떻게 움직이나요?"
          tip={<Tip lead="'~하면 ~돼요'처럼, 무슨 일이 일어나는지 규칙을 적어요." examples={['정답을 맞히면 점수가 1점 올라가요', '벽에 부딪히면 게임이 끝나요']} />}
        >
          <TextArea
            value={plan.how}
            onChange={(e) => setField('how', e.target.value)}
            placeholder="예: 정답을 맞히면 점수가 1점 올라가요"
            maxLength={5000}
          />
        </Label>
        <Label
          text="더 바라는 점"
          tip={<Tip lead="소리, 점수, 축하 효과처럼 바라는 점을 자유롭게 적어요. 없으면 비워도 돼요!" examples={['정답일 때 박수 소리가 나면 좋겠어요', '휴대폰에서도 잘 보이게 해주세요']} />}
        >
          <TextArea
            value={plan.etc}
            onChange={(e) => setField('etc', e.target.value)}
            placeholder="예: 휴대폰에서도 잘 보이게 해주세요"
            maxLength={5000}
          />
        </Label>

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] bg-surface-2 p-3">
          <span className="w-full text-[14px] text-muted">아이디어가 없나요? 예시로 시작해 보세요</span>
          {EXAMPLE_PLANS.map((ex, i) => (
            <Chip
              key={ex.name}
              color={CHIP_COLORS[(i + 1) % CHIP_COLORS.length]}
              active={exampleIndex === i}
              onClick={() => setExampleIndex(i)}
            >
              {ex.name}
            </Chip>
          ))}
          <Button variant="soft" onClick={applyExample} className="min-h-11 w-full">
            이 예시 가져오기
          </Button>
        </div>

        {(isStudent || isTeacher) && <PhotoUpload value={photo} onChange={setPhoto} />}

        <Button variant="primary" size="lg" onClick={handleGenerate} disabled={busy} className="w-full">
          <Wand2 size={21} aria-hidden />
          {loading === 'generating' ? '만드는 중…' : '프로그램 만들기'}
        </Button>
      </Card>

      {/* 오른쪽: 결과 */}
      <ResultPanel
        busy={busy}
        streamingPartial={streamingPartial}
        onCancel={handleCancel}
        hasCode={hasCode}
        code={code}
        previewKey={previewKey}
        resultTab={resultTab}
        setResultTab={setResultTab}
        editing={editing}
        saving={saving}
        onSaveEdit={handleSaveEdit}
        onUpload={() => (user ? setUploadOpen(true) : setLoginOpen(true))}
        onDownload={handleDownload}
        onReset={handleReset}
        modifyText={modifyText}
        setModifyText={setModifyText}
        onModify={handleModify}
        modifyRef={modifyRef}
        onNeedLogin={() => setLoginOpen(true)}
        photo={photo ?? undefined}
      />

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        code={code}
        plan={plan}
        prompt={genPrompt}
        defaultTitle={plan.name}
        forkedFrom={forkSource?.id}
        forkedFromAuthor={forkSource?.author}
        defaultCategoryId={forkSource?.categoryId}
        photo={photo ?? undefined}
      />
    </div>
  );
}
