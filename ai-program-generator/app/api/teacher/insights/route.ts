import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { lastDayKeysKST } from '@/lib/usageDay';
import { detectConcepts } from '@/lib/edu/detectConcepts';
import { CONCEPT_ORDER } from '@/lib/edu/concepts';
import type { GeneratedCode } from '@/lib/ai/types';

export const runtime = 'nodejs';

// 교사 학습 대시보드(교육 Phase 2, MVP + 개념 커버리지). 새 컬렉션·쓰기 없이
// 이미 쌓이는 usage(시도)·posts(작품·개념)를 읽어 반 요약 + 학생×개념 격자로 집계.
// 개념은 detectConcepts(순수함수, 서버 실행) — 배지·도감과 동일 소스, 구버전 글도 소급.
const DAYS = 14; // 활동량 집계 기간(usage). 커버리지(개념)는 누적이라 기간 무관.

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const stuSnap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
    const roster = stuSnap.docs.map((d) => ({
      uid: d.id,
      name: (d.get('name') as string) || '',
      hakbun: (d.get('hakbun') as string) || '',
      // 총량제(total) 학생은 usage 문서를 안 남기고 students.usedTotal에 누적 → 시도 집계에 반영해야 안 보이지 않음.
      isTotal: (d.get('limitType') as string) === 'total',
      usedTotal: (d.get('usedTotal') as number) ?? 0,
    }));
    if (roster.length === 0) {
      return NextResponse.json({ students: [], summary: { studentCount: 0, activeCount: 0, totalWorks: 0, totalAttempts: 0 } });
    }
    const uids = roster.map((s) => s.uid);

    // 활동량 — usage/{uid}_{day} 최근 14일 getAll(없는 날은 미과금·건너뜀).
    const days = lastDayKeysKST(DAYS);
    const usageRefs = uids.flatMap((u) => days.map((day) => adminDb.doc(`usage/${u}_${day}`)));
    const attempts = new Map<string, number>();
    const lastActive = new Map<string, number>();
    if (usageRefs.length) {
      const snaps = await adminDb.getAll(...usageRefs);
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const data = snap.data()!;
        const uid = data.uid as string;
        if (!uid) continue;
        attempts.set(uid, (attempts.get(uid) ?? 0) + ((data.count as number) ?? 0));
        const upd = (data.updatedAt as number) ?? 0;
        if (upd > (lastActive.get(uid) ?? 0)) lastActive.set(uid, upd);
      }
    }

    // 작품·개념 — posts where ownerUid in [학생](30개씩). code에서 detectConcepts로 개념 합집합.
    const works = new Map<string, number>();
    const concepts = new Map<string, Set<string>>();
    for (let i = 0; i < uids.length; i += 30) {
      const chunk = uids.slice(i, i + 30);
      const psnap = await adminDb.collection('posts').where('ownerUid', 'in', chunk).get();
      for (const doc of psnap.docs) {
        const p = doc.data();
        const uid = p.ownerUid as string;
        if (!uid) continue;
        works.set(uid, (works.get(uid) ?? 0) + 1);
        const code = p.code as GeneratedCode | undefined;
        if (code) {
          let set = concepts.get(uid);
          if (!set) concepts.set(uid, (set = new Set()));
          for (const c of detectConcepts(code)) set.add(c);
        }
        const created = (p.createdAt as number) ?? 0;
        if (created > (lastActive.get(uid) ?? 0)) lastActive.set(uid, created);
      }
    }

    const students = roster
      .map((s) => ({
        uid: s.uid,
        name: s.name || s.hakbun || s.uid.slice(0, 6),
        hakbun: s.hakbun,
        works: works.get(s.uid) ?? 0,
        // 일일제=최근 14일 usage 합, 총량제=누적 usedTotal(usage 미기록이라). 세그먼트별 의미 다름은 UI에 명시.
        attempts: s.isTotal ? s.usedTotal : (attempts.get(s.uid) ?? 0),
        lastActive: lastActive.get(s.uid) ?? null,
        concepts: CONCEPT_ORDER.filter((c) => concepts.get(s.uid)?.has(c)),
      }))
      .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

    const summary = {
      studentCount: roster.length,
      // 활동 = 시도했거나(usage/누적) 작품을 올린 학생 — 총량제·미게시 학생이 '0명'으로 안 빠지게.
      activeCount: students.filter((s) => s.attempts > 0 || s.works > 0).length,
      totalWorks: students.reduce((n, s) => n + s.works, 0),
      totalAttempts: students.reduce((n, s) => n + s.attempts, 0),
    };
    return NextResponse.json({ students, summary });
  } catch (e) {
    console.error('교사 학습 현황 조회 실패:', e);
    return NextResponse.json({ error: '학습 현황을 불러오지 못했어요.' }, { status: 500 });
  }
}
