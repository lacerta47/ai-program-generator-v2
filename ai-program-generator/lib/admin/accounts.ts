import { authedJson } from '@/lib/client/authedFetch';

export interface CreateResult {
  created: { email: string; password: string }[];
  skipped: { email: string; reason: string }[];
}

export type CreateBody =
  | { mode: 'single'; email: string; password: string }
  | { mode: 'batch'; prefix: string; count: number; password: string };

export function createAccounts(body: CreateBody): Promise<CreateResult> {
  return authedJson('/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getConfig(): Promise<{ dailyLimit: number }> {
  return authedJson('/api/admin/config');
}

export function setConfig(dailyLimit: number): Promise<{ dailyLimit: number }> {
  return authedJson('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyLimit }),
  });
}

export function patchUser(
  uid: string,
  body: { disabled?: boolean; dailyLimit?: number | null; password?: string },
): Promise<{ ok: true }> {
  return authedJson(`/api/admin/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteUserAccount(uid: string): Promise<{ ok: true }> {
  return authedJson(`/api/admin/users/${uid}`, { method: 'DELETE' });
}
