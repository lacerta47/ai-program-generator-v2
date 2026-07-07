// easy → create 브릿지(교육 Phase 2). 골라만들기 결과(저장 안 된 인메모리 상태)를
// 만들기 화면으로 넘기는 1회성 핸드오프. sessionStorage로 전달 — 서버·저장·재생성 0.
// SurveyWizard가 stash → /create?from=easy 이동 → useCreatorSource가 take(읽고 즉시 제거).

import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

const KEY = 'lun:easy-bridge';

export interface EasyBridgeDraft {
  plan: PlanFields;
  code: GeneratedCode;
  genPrompt: string;
  photo: string | null;
}

export function stashEasyDraft(d: EasyBridgeDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* sessionStorage 차단 환경은 조용히 무시(브릿지만 실패, 나머지 정상) */
  }
}

/** 읽고 즉시 제거(1회성). 없거나 파싱 실패·코드 없으면 null. */
export function takeEasyDraft(): EasyBridgeDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as EasyBridgeDraft;
    if (!d || !d.code || typeof d.code.html !== 'string') return null;
    return d;
  } catch {
    return null;
  }
}
