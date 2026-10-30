import { authedJson } from '@/lib/client/authedFetch';

export function getConfig(): Promise<{ totalLimit: number }> {
  return authedJson('/api/admin/config');
}

export function setConfig(totalLimit: number): Promise<{ totalLimit: number }> {
  return authedJson('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalLimit }),
  });
}

export function patchUser(
  uid: string,
  body: { disabled?: boolean; totalLimit?: number | null; password?: string },
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
