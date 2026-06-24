import { authedJson } from '@/lib/client/authedFetch';

/** 본인 계정 탈퇴 요청. 성공 시 호출부에서 signOut + 홈 이동. */
export async function deleteMyAccount(): Promise<void> {
  await authedJson('/api/me', { method: 'DELETE' });
}
