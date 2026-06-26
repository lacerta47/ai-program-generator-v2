import { authedJson } from '@/lib/client/authedFetch';

export const getViewPinStatus = (): Promise<{ hasPin: boolean }> => authedJson('/api/teacher/view-pin');

export const setViewPin = (pin: string): Promise<{ ok: true }> =>
  authedJson('/api/teacher/view-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
