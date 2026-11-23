'use client';

import { useState } from 'react';

/** 로그인 전 입력은 이어가고, 로그인했던 계정에서 나갈 때는 작업 화면 전체를 초기화한다. */
export function useWorkSessionKey(uid: string | null) {
  const [session, setSession] = useState({ uid, key: 0 });
  if (session.uid === uid) return session.key;
  const next = { uid, key: session.uid === null ? session.key : session.key + 1 };
  setSession(next);
  return next.key;
}
