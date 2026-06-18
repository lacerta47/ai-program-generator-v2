'use client';

import { useState } from 'react';
import { Eye, Code2, Copy, Check, Download, Upload, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { TextArea, HelpTip } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';
import BuilderBot from '@/components/ui/BuilderBot';
import FloatingShapes from '@/components/ui/FloatingShapes';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import CodeView from '@/components/ui/CodeView';
import EmptyParticles from '@/components/fx/EmptyParticles';
import { useToast } from '@/components/ui/Toast';
import { currentStage, STAGE_LABEL, STAGE_CONCEPT, STAGE_ORDER } from '@/lib/ai/streamStages';
import { Tip } from './Tip';

type CodeTab = 'html' | 'css' | 'javascript';
type ResultTab = 'preview' | 'code';

interface Props {
  busy: boolean;
  streamingPartial: Partial<GeneratedCode>;
  onCancel: () => void;
  hasCode: boolean;
  code: GeneratedCode;
  previewKey: number;
  resultTab: ResultTab;
  setResultTab: (t: ResultTab) => void;
  editing: { id: string; title: string; authorName: string } | null;
  saving: boolean;
  onSaveEdit: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onReset: () => void;
  modifyText: string;
  setModifyText: (s: string) => void;
  onModify: () => void;
  modifyRef: React.RefObject<HTMLTextAreaElement | null>;
}

/** 생성기 오른쪽 '결과' 패널 — 로딩/빈상태/결과(미리보기·코드·수정요청)를 담당. */
export default function ResultPanel({
  busy,
  streamingPartial,
  onCancel,
  hasCode,
  code,
  previewKey,
  resultTab,
  setResultTab,
  editing,
  saving,
  onSaveEdit,
  onUpload,
  onDownload,
  onReset,
  modifyText,
  setModifyText,
  onModify,
  modifyRef,
}: Props) {
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code[codeTab] || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('복사하지 못했어요. 코드를 길게 눌러 복사해 보세요.');
    }
  }

  return (
    <Card animate className="flex min-h-[70vh] flex-col gap-4" style={{ animationDelay: '60ms' }}>
      {busy ? (
        (() => {
          const stage = currentStage(streamingPartial);
          const liveCode = stage ? streamingPartial[stage] ?? '' : '';
          return (
            <div className="flex flex-1 flex-col gap-3">
              {/* 개념 내레이션 배너 — 지금 만드는 층 */}
              <div className="flex items-center gap-2.5 rounded-[var(--r-md)] border-2 border-brand/30 bg-brand-soft px-4 py-3">
                <LoadingDots />
                <span className="text-[16px] text-brand-strong dark:text-brand">
                  {stage ? STAGE_LABEL[stage] : 'AI가 준비하고 있어요…'}
                </span>
              </div>
              {/* 3층 개념 칩(구조·스타일·동작) */}
              <div className="flex gap-1.5">
                {STAGE_ORDER.map((s) => (
                  <span
                    key={s}
                    className={`rounded-full px-3 py-1 text-[13px] font-medium ${
                      stage === s ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {STAGE_CONCEPT[s]}
                  </span>
                ))}
              </div>
              {/* 라이브 강조 코드(미완성 → 포맷 생략) */}
              <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line">
                {liveCode && stage ? (
                  <CodeView code={liveCode} language={stage} skipFormat className="h-full min-h-[44vh] bg-surface" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BuilderBot />
                  </div>
                )}
              </div>
              <Button variant="ghost" onClick={onCancel} className="self-center">
                그만 만들기
              </Button>
            </div>
          );
        })()
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
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <Button variant="primary" onClick={onSaveEdit} disabled={saving || busy}>
                  <Save size={17} aria-hidden /> {saving ? '저장 중…' : '수정 저장'}
                </Button>
              ) : (
                <Button variant="soft" onClick={onUpload}>
                  <Upload size={17} aria-hidden /> 게시판에 올리기
                </Button>
              )}
              <Button variant="ghost" onClick={onDownload}>
                <Download size={17} aria-hidden /> 저장하기
              </Button>
              <Button variant="ghost" onClick={onReset} title={editing ? '편집 취소' : '계획서와 결과를 지우고 처음부터'}>
                <RotateCcw size={17} aria-hidden /> {editing ? '편집 취소' : '새로 만들기'}
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
                <CodeView code={code[codeTab]} language={codeTab} className="min-h-[44vh] flex-1 bg-surface" />
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
              <Button variant="primary" onClick={onModify} disabled={busy} className="sm:self-end">
                고쳐 줘!
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
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
