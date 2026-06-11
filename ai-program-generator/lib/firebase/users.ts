import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './client';
import type { UserProfile } from './types';

const COL = 'users';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** 닉네임 저장(없으면 생성, 있으면 갱신) */
export async function saveNickname(uid: string, nickname: string): Promise<void> {
  await setDoc(doc(db, COL, uid), { nickname: nickname.trim() }, { merge: true });
}
