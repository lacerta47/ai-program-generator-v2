import { auth } from '@/lib/firebase/client';

export interface CreateResult {
  created: { email: string; password: string }[];
  skipped: { email: string; reason: string }[];
}

export type CreateBody =
  | { mode: 'single'; email: string; password: string }
  | { mode: 'batch'; prefix: string; count: number; password: string };

async function authedFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export function createAccounts(body: CreateBody): Promise<CreateResult> {
  return authedFetch('/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getConfig(): Promise<{ dailyLimit: number }> {
  return authedFetch('/api/admin/config');
}

export function setConfig(dailyLimit: number): Promise<{ dailyLimit: number }> {
  return authedFetch('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyLimit }),
  });
}

export function patchUser(
  uid: string,
  body: { disabled?: boolean; dailyLimit?: number | null },
): Promise<{ ok: true }> {
  return authedFetch(`/api/admin/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteUserAccount(uid: string): Promise<{ ok: true }> {
  return authedFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
}
