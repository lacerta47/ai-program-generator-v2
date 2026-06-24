import { auth } from '@/lib/firebase/client';

/** Firebase ID 토큰을 Bearer로 붙여 fetch. 원시 Response 반환(스트리밍·프리뷰용). */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  return fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` } });
}

/** authedFetch + JSON 파싱 + !ok면 data.error로 throw(CRUD 헬퍼용). */
export async function authedJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `요청 실패 (${res.status})`);
  return data as T;
}
