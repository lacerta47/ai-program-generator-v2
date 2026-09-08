import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

/**
 * 생성 코드 게이트 탈락을 stats/{day}에 누적(일일 리포트용 — 새 검사가 정상 작품을 막는지 감시).
 * 필드: gateFail(총), gateFailBy.{reason}(사유별), 자동예시는 gateFailExample / gateFailExampleBy.{reason}.
 * fire-and-forget — 집계 실패가 응답에 영향을 주지 않는다.
 */
export function recordGateFail(day: string, reason: string, source: 'user' | 'example'): void {
  const key = reason.replace(/[^A-Za-z]/g, '') || 'other';
  const total = source === 'example' ? 'gateFailExample' : 'gateFail';
  const by = source === 'example' ? 'gateFailExampleBy' : 'gateFailBy';
  adminDb
    .doc(`stats/${day}`)
    .set({ [total]: FieldValue.increment(1), [by]: { [key]: FieldValue.increment(1) } }, { merge: true })
    .catch(() => {});
}
