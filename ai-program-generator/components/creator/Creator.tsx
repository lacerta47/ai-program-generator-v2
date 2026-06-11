'use client';

import { useRef, useState } from 'react';
import {
  Sparkles,
  Wand2,
  Eye,
  Code2,
  Copy,
  Check,
  Download,
  Upload,
  Lightbulb,
} from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import { requestGenerate } from '@/lib/client/generate';
import { downloadProgramZip } from '@/lib/client/downloadZip';
import { EXAMPLE_PLANS } from '@/lib/examples';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import UploadDialog from '@/components/board/UploadDialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip, { CHIP_COLORS } from '@/components/ui/Chip';
import { TextInput, TextArea, Label, HelpTip } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';
import { useToast } from '@/components/ui/Toast';
import FloatingShapes from '@/components/ui/FloatingShapes';
import BuilderBot from '@/components/ui/BuilderBot';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import CodeView from '@/components/ui/CodeView';
import EmptyParticles from '@/components/fx/EmptyParticles';

type CodeTab = 'html' | 'css' | 'javascript';
type ResultTab = 'preview' | 'code';

const EMPTY_CODE: GeneratedCode = { html: '', css: '', javascript: '' };

interface PlanFields {
  name: string;
  look: string;
  usage: string;
  how: string;
  etc: string;
}

const EMPTY_PLAN: PlanFields = { name: '', look: '', usage: '', how: '', etc: '' };

const GENERATE_MESSAGES = [
  '계획서를 읽고 있어요…',
  '어떻게 만들지 생각하는 중…',
  '화면을 그리고 있어요…',
  '버튼에 마법을 거는 중…',
  '거의 다 됐어요!',
];

const MODIFY_MESSAGES = [
  '어디를 바꿀지 찾고 있어요…',
  '코드를 살펴보는 중…',
  '말한 대로 고치는 중…',
  '새 모습을 입히는 중…',
  '거의 다 됐어요!',
];

function buildGeneratePrompt(p: PlanFields): string {
  return `프로그램 계획서:
- 프로그램 이름: ${p.name}
- 프로그램 모습 (배경, 아이콘 등): ${p.look}
- 사용법 및 조작 방법: ${p.usage}
- 동작 방식: ${p.how}
- 기타 사항: ${p.etc}`;
}

function buildModifyPrompt(p: PlanFields, code: GeneratedCode, request: string): string {
  return `기존에 생성된 웹사이트 코드에 다음 요청사항을 반영하여 코드를 수정해주세요.
기존 프로그램 계획서:
- 프로그램 이름: ${p.name}
- 프로그램 모습: ${p.look}
- 사용법: ${p.usage}
- 동작 방식: ${p.how}
- 기타 사항: ${p.etc}

기존 코드:
- HTML: ${JSON.stringify(code.html)}
- CSS: ${JSON.stringify(code.css)}
- JavaScript: ${JSON.stringify(code.javascript)}

사용자 수정 요청사항: ${request}`;
}

export default function Creator() {
  const [plan, setPlan] = useState<PlanFields>(EMPTY_PLAN);
  const [code, setCode] = useState<GeneratedCode>(EMPTY_CODE);
  const [loading, setLoading] = useState<'idle' | 'generating' | 'modifying'>('idle');
  const [loadingMsg, setLoadingMsg] = useState(GENERATE_MESSAGES[0]);
  const [resultTab, setResultTab] = useState<ResultTab>('preview');
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [modifyText, setModifyText] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const modifyRef = useRef<HTMLTextAreaElement>(null);
  const hasCode = Boolean(code.html || code.css || code.javascript);
  const busy = loading !== 'idle';

  const setField = (key: keyof PlanFields, value: string) =>
    setPlan((prev) => ({ ...prev, [key]: value }));

  function startLoadingMessages(messages: string[]) {
    let i = 0;
    setLoadingMsg(messages[0]);
    const id = window.setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 2500);
    return () => window.clearInterval(id);
  }

  async function handleGenerate() {
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
    setLoading('generating');
    const stop = startLoadingMessages(GENERATE_MESSAGES);
    try {
      const result = await requestGenerate(promptText, 'generate');
      setCode(result);
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
    } finally {
      stop();
      setLoading('idle');
    }
  }

  async function handleModify() {
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
    const stop = startLoadingMessages(MODIFY_MESSAGES);
    try {
      const result = await requestGenerate(buildModifyPrompt(plan, code, modifyText), 'modify');
      setCode(result);
      setModifyText('');
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : '고치다가 문제가 생겼어요. 다시 해볼까요?');
    } finally {
      stop();
      setLoading('idle');
    }
  }

  function applyExample() {
    const ex = EXAMPLE_PLANS[exampleIndex];
    setPlan({ name: ex.name, look: ex.look, usage: ex.usage, how: ex.how, etc: ex.etc });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code[codeTab] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(360px,5fr)_7fr]">
      {/* 왼쪽: 계획서 */}
      <Card animate className="flex flex-col gap-4 self-start">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-brand-soft text-brand-strong dark:text-brand">
            <Lightbulb size={20} aria-hidden />
          </span>
          <h2 className="text-[21px]">어떤 프로그램을 만들까요?</h2>
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

        <Button variant="primary" size="lg" onClick={handleGenerate} disabled={busy} className="w-full">
          <Wand2 size={21} aria-hidden />
          {loading === 'generating' ? '만드는 중…' : '프로그램 만들기'}
        </Button>
      </Card>

      {/* 오른쪽: 결과 */}
      <Card animate className="flex min-h-[70vh] flex-col gap-4" style={{ animationDelay: '60ms' }}>
        {busy ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-7">
            <BuilderBot />
            <LoadingDots label={loadingMsg} />
          </div>
        ) : !hasCode ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-[var(--r-md)] text-center">
            <EmptyParticles />
            <FloatingShapes />
            <div className="relative">
              <h3 className="mb-1 text-[22px]">여기에 프로그램이 나타나요</h3>
              <p className="max-w-[36ch] text-[16px] text-muted">
                왼쪽에 만들고 싶은 프로그램을 적고
                <br />
                <strong className="text-brand-strong dark:text-brand">프로그램 만들기</strong> 버튼을 눌러 보세요!
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 결과 탭 — 슬라이드 인디케이터 */}
              <div className="relative grid grid-cols-2 rounded-full border-2 border-line bg-surface-2 p-1">
                <span
                  aria-hidden
                  className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-brand transition-transform duration-200"
                  style={{
                    transform: resultTab === 'preview' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))',
                    transitionTimingFunction: 'var(--ease-out)',
                  }}
                />
                <TabButton active={resultTab === 'preview'} onClick={() => setResultTab('preview')}>
                  <Eye size={16} aria-hidden /> 미리보기
                </TabButton>
                <TabButton active={resultTab === 'code'} onClick={() => setResultTab('code')}>
                  <Code2 size={16} aria-hidden /> 코드
                </TabButton>
              </div>
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => (user ? setUploadOpen(true) : setLoginOpen(true))}>
                  <Upload size={17} aria-hidden /> 게시판에 올리기
                </Button>
                <Button variant="ghost" onClick={() => downloadProgramZip(code, plan.name)}>
                  <Download size={17} aria-hidden /> 저장하기
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line">
              {resultTab === 'preview' ? (
                <FullscreenFrame
                  frameKey={previewKey}
                  code={code}
                  title="내가 만든 프로그램 미리보기"
                  className="h-full min-h-[52vh] w-full"
                />
              ) : (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b-2 border-line bg-surface-2 px-3 py-2">
                    <div className="flex gap-1">
                      {(['html', 'css', 'javascript'] as CodeTab[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setCodeTab(t)}
                          className={`press min-h-9 rounded-full px-3.5 text-[13px] font-medium ${
                            codeTab === t
                              ? 'bg-brand text-brand-ink'
                              : 'text-muted hover:bg-brand-soft hover:text-brand-strong'
                          }`}
                        >
                          {t === 'javascript' ? 'JS' : t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <Button variant="ghost" onClick={handleCopy} className="min-h-9 border-0 px-3 text-[13px]">
                      {copied ? (
                        <span className="anim-pop inline-flex items-center gap-1 text-mint-ink">
                          <Check size={15} aria-hidden /> 복사했어요!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Copy size={15} aria-hidden /> 코드 복사
                        </span>
                      )}
                    </Button>
                  </div>
                  <CodeView
                    code={code[codeTab]}
                    language={codeTab}
                    className="min-h-[44vh] flex-1 bg-surface"
                  />
                </div>
              )}
            </div>

            {/* 수정 요청 */}
            <div className="flex flex-col gap-2.5 rounded-[var(--r-md)] bg-surface-2 p-4">
              <div className="flex items-center gap-1.5 text-[15px] font-medium text-muted">
                <Sparkles size={16} className="text-grape" aria-hidden />
                바꾸고 싶은 게 있나요? 말해 보세요
                <HelpTip>
                  <Tip
                    lead="한 번에 한 가지씩, 어디를 어떻게 바꿀지 말해요. 여러 번 고쳐도 돼요!"
                    examples={['버튼을 더 크게 만들어 줘', '배경을 분홍색으로 바꿔 줘', '점수가 화면에 보이게 해 줘']}
                  />
                </HelpTip>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextArea
                  ref={modifyRef}
                  value={modifyText}
                  onChange={(e) => setModifyText(e.target.value)}
                  placeholder="예: 버튼을 빨간색으로 바꿔 줘"
                  rows={2}
                  className="min-h-12 flex-1"
                />
                <Button variant="primary" onClick={handleModify} disabled={busy} className="sm:self-end">
                  고쳐 줘!
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        code={code}
        prompt={genPrompt}
        defaultTitle={plan.name}
      />
    </div>
  );
}

function Tip({ lead, examples }: { lead: string; examples: string[] }) {
  return (
    <>
      <p>{lead}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {examples.map((ex) => (
          <li key={ex} className="rounded-[8px] bg-surface-2 px-2.5 py-1 text-[12.5px] text-muted">
            {ex}
          </li>
        ))}
      </ul>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors duration-200 ${
        active ? 'text-brand-ink' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
