import { auth } from '@/lib/firebase/client';

/** 본인 계정 탈퇴 요청. 성공 시 호출부에서 signOut + 홈 이동. */
export async function deleteMyAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '계정을 삭제하지 못했어요.');
}
