import { adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: 'pool' | 'cap-daily' | 'cap-total' | 'misconfig' };

/** 학생 생성 한도 선점: 선생님 공유 풀 + 학생 캡을 한 트랜잭션에서 체크·차감. */
export async function reserveStudentQuota(uid: string): Promise<ReserveResult> {
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
      if (pool >= cap) return { ok: false, reason: 'pool' };
      if (limitType === 'total') {
        if (studentUsed >= limitValue) return { ok: false, reason: 'cap-total' };
      } else if (dayCount >= limitValue) {
        return { ok: false, reason: 'cap-daily' };
      }

      // --- writes ---
      tx.set(teacherRef, { usedTotal: pool + 1 }, { merge: true });
      tx.set(studentRef, { usedTotal: studentUsed + 1 }, { merge: true });
      if (limitType === 'daily') {
        tx.set(usageRef, { uid, day, count: dayCount + 1, updatedAt: Date.now() }, { merge: true });
      }
      return { ok: true };
    });
  } catch (e) {
    console.error('[studentQuota] reserve 실패:', e);
    return { ok: false, reason: 'misconfig' };
  }
}

/** 학생 생성 실패/취소 시 선점분 환불(풀·학생 누적·일일 모두, 0 미만 방지). */
export async function refundStudentQuota(uid: string): Promise<void> {
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
      if (studentUsed > 0) tx.update(studentRef, { usedTotal: studentUsed - 1 });
      if (teacherRef && tSnap && tSnap.exists) {
        const pool = (tSnap.data()?.usedTotal as number | undefined) ?? 0;
        if (pool > 0) tx.update(teacherRef, { usedTotal: pool - 1 });
      }
      if (uSnap) {
        const dayCount = (uSnap.data()?.count as number | undefined) ?? 0;
        if (dayCount > 0) tx.update(usageRef, { count: dayCount - 1, updatedAt: Date.now() });
      }
    });
  } catch (e) {
    console.error('[studentQuota] refund 실패:', e);
  }
}
