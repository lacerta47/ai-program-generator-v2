import { doc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/** 이 기기를 활성 세션으로 등록하고 세션 id를 반환(이전 세션을 밀어냄). */
export async function claimSession(uid: string): Promise<string> {
  const id = crypto.randomUUID();
  await setDoc(doc(db, 'sessions', uid), { activeToken: id, updatedAt: serverTimestamp() });
  return id;
}

/** activeToken이 내 세션과 달라지면(=다른 기기 로그인) onKicked 호출. */
export function watchSession(uid: string, myId: string, onKicked: () => void): Unsubscribe {
  return onSnapshot(doc(db, 'sessions', uid), (snap) => {
    const tok = snap.data()?.activeToken as string | undefined;
    if (tok && tok !== myId) onKicked();
  });
}
