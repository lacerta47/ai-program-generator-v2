import { adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: 'pool' | 'cap-daily' | 'cap-total' | 'misconfig' };

/** 학생 생성 한도 선점: 선생님 공유 풀 + 학생 캡을 한 트랜잭션에서 체크·차감. */
export async function reserveStudentQuota(uid: string, cost = 1): Promise<ReserveResult> {
  const studentRef = adminDb.doc(`students/${uid}`);
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  try {
    return await adminDb.runTransaction<ReserveResult>(async (tx) => {
      // --- reads (모든 read를 write보다 먼저) ---
      const sSnap = await tx.get(studentRef);
      const s = sSnap.data();
      if (!s || typeof s.teacherUid !== 'string') return { ok: false, reason: 'misconfig' };
      const teacherRef = adminDb.doc(`teachers/${s.teacherUid}`);
      const tSnap = await tx.get(teacherRef);
      const t = tSnap.data();
      if (!t) return { ok: false, reason: 'misconfig' };

      const pool = (t.usedTotal as number | undefined) ?? 0;
      const cap = (t.totalQuota as number | undefined) ?? 0;
      const limitType = s.limitType === 'total' ? 'total' : 'daily';
      const limitValue = (s.limitValue as number | undefined) ?? 0;
      const studentUsed = (s.usedTotal as number | undefined) ?? 0;

      let dayCount = 0;
      if (limitType === 'daily') {
        const uSnap = await tx.get(usageRef);
        dayCount = (uSnap.data()?.count as number | undefined) ?? 0;
      }

      // --- checks ---
      if (pool + cost > cap) return { ok: false, reason: 'pool' };
      if (limitType === 'total') {
        if (studentUsed + cost > limitValue) return { ok: false, reason: 'cap-total' };
      } else if (dayCount + cost > limitValue) {
        return { ok: false, reason: 'cap-daily' };
      }

      // --- writes ---
      tx.set(teacherRef, { usedTotal: pool + cost }, { merge: true });
      // student.usedTotal은 '총형 캡 소진량'만 추적 — 1일형은 usage 일일 카운터로만 제한.
      // (1일형도 누적하면 나중에 총형으로 바꿀 때 누적분이 캡에 걸려 잠기는 footgun)
      if (limitType === 'total') tx.set(studentRef, { usedTotal: studentUsed + cost }, { merge: true });
      if (limitType === 'daily') {
        tx.set(usageRef, { uid, day, count: dayCount + cost, updatedAt: Date.now() }, { merge: true });
      }
      return { ok: true };
    });
  } catch (e) {
    console.error('[studentQuota] reserve 실패:', e);
    return { ok: false, reason: 'misconfig' };
  }
}

/** 학생 생성 실패/취소 시 선점분 환불(풀·학생 누적·일일 모두, 0 미만 방지). */
export async function refundStudentQuota(uid: string, cost = 1): Promise<void> {
  const studentRef = adminDb.doc(`students/${uid}`);
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  try {
    await adminDb.runTransaction(async (tx) => {
      const sSnap = await tx.get(studentRef);
      const s = sSnap.data();
      if (!s) return;
      const teacherRef = typeof s.teacherUid === 'string' ? adminDb.doc(`teachers/${s.teacherUid}`) : null;
      const tSnap = teacherRef ? await tx.get(teacherRef) : null;
      const limitType = s.limitType === 'total' ? 'total' : 'daily';
      const uSnap = limitType === 'daily' ? await tx.get(usageRef) : null;

      const studentUsed = (s.usedTotal as number | undefined) ?? 0;
      // 총형만 student.usedTotal을 차감(reserve와 대칭 — 1일형은 usage만 환불).
      if (limitType === 'total' && studentUsed > 0) tx.update(studentRef, { usedTotal: Math.max(0, studentUsed - cost) });
      if (teacherRef && tSnap && tSnap.exists) {
        const pool = (tSnap.data()?.usedTotal as number | undefined) ?? 0;
        if (pool > 0) tx.update(teacherRef, { usedTotal: Math.max(0, pool - cost) });
      }
      if (uSnap) {
        const dayCount = (uSnap.data()?.count as number | undefined) ?? 0;
        if (dayCount > 0) tx.update(usageRef, { count: Math.max(0, dayCount - cost), updatedAt: Date.now() });
      }
    });
  } catch (e) {
    console.error('[studentQuota] refund 실패:', e);
  }
}
