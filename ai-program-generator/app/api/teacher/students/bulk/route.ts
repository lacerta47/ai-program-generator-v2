import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { getOwnedStudent } from '@/lib/server/ownedStudent';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';
// 다수 학생 캐스케이드 삭제가 길어질 수 있어 여유를 둔다(한 반 규모 기준으로 충분).
export const maxDuration = 60;

/** body.uids를 문자열 배열로 정규화(중복 제거·1~100 상한). 규격 밖이면 null. */
function parseUids(b: Record<string, unknown>): string[] | null {
  if (!Array.isArray(b.uids)) return null;
  const uids = Array.from(new Set(b.uids.filter((x): x is string => typeof x === 'string' && x.length > 0)));
  if (uids.length === 0 || uids.length > 100) return null;
  return uids;
}

/** 일괄 한도 조절. body: { uids, limitType?, limitValue? } — 최소 하나는 있어야 함. */
export async function PATCH(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const uids = parseUids(b);
  if (!uids) return NextResponse.json({ error: '학생을 1~100명 선택해 주세요.' }, { status: 400 });

  const limitType = b.limitType === 'daily' || b.limitType === 'total' ? b.limitType : undefined;
  let limitValue: number | undefined;
  if ('limitValue' in b) {
    const v = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
    }
    limitValue = v;
  }
  if (limitType === undefined && limitValue === undefined) {
    return NextResponse.json({ error: '바꿀 한도 값이 없어요.' }, { status: 400 });
  }

  const updated: string[] = [];
  const failed: string[] = [];
  for (const uid of uids) {
    const cur = await getOwnedStudent(gate.uid, uid);
    if (!cur) {
      failed.push(uid);
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (limitType !== undefined) {
      patch.limitType = limitType;
      // 종류가 바뀌면 누적 캡 카운터 초기화(단일 PATCH와 동일 규칙 — 이전 종류 소진분 이월 방지).
      if (limitType !== cur.limitType) patch.usedTotal = 0;
    }
    if (limitValue !== undefined) patch.limitValue = limitValue;
    try {
      await adminDb.doc(`students/${uid}`).set(patch, { merge: true });
      updated.push(uid);
    } catch (e) {
      console.error('일괄 한도 변경 실패:', uid, e);
      failed.push(uid);
    }
  }
  return NextResponse.json({ updated, failed });
}

/** 일괄 삭제. body: { uids } */
export async function DELETE(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const uids = parseUids(b);
  if (!uids) return NextResponse.json({ error: '학생을 1~100명 선택해 주세요.' }, { status: 400 });

  const deleted: string[] = [];
  const failed: string[] = [];
  // 순차 처리 — deleteAccountCascade가 각자 질의+배치+Auth 삭제를 하므로 동시 실행 시
  // Firestore/Auth 레이트리밋에 걸리기 쉽다. 한 반 규모에서는 순차로 충분히 빠르다.
  for (const uid of uids) {
    const cur = await getOwnedStudent(gate.uid, uid);
    if (!cur) {
      failed.push(uid);
      continue;
    }
    try {
      await deleteAccountCascade(uid);
      deleted.push(uid);
    } catch (e) {
      console.error('일괄 삭제 실패:', uid, e);
      failed.push(uid);
    }
  }
  return NextResponse.json({ deleted, failed });
}
