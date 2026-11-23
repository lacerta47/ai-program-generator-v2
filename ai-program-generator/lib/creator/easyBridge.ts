// easy → create 브릿지(교육 Phase 2). 골라만들기 결과(저장 안 된 인메모리 상태)를
// 만들기 화면으로 넘기는 1회성 핸드오프. sessionStorage로 전달 — 서버·저장·재생성 0.
// SurveyWizard가 stash → /create?from=easy 이동 → useCreatorSource가 take(읽고 즉시 제거).

import type { WorkSnapshot } from './workHistory';

const KEY = 'lun:easy-bridge';

export interface EasyBridgeDraft extends WorkSnapshot {
  uid: string;
}

export function stashEasyDraft(d: EasyBridgeDraft): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** 읽고 즉시 제거(1회성). 없거나 파싱 실패·코드 없으면 null. */
export function takeEasyDraft(uid: string | null): WorkSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as EasyBridgeDraft;
    if (!d || !uid || d.uid !== uid || !d.code || typeof d.code.html !== 'string') return null;
    return { plan: d.plan, code: d.code, genPrompt: d.genPrompt, photo: d.photo, meta: d.meta };
  } catch {
    return null;
  }
}
