import { describe, expect, it } from 'vitest';
import { EMPTY_PLAN } from '@/lib/firebase/types';
import { addWorkRevision, selectWorkVersion, startWork, type WorkSnapshot } from './workHistory';

const snapshot = (name: string): WorkSnapshot => ({
  code: { html: name, css: '', javascript: '' },
  plan: { ...EMPTY_PLAN, name },
  genPrompt: name,
  photo: name + '-photo',
  meta: { logicSummary: name },
});

describe('work history', () => {
  it('restores the entire snapshot and keeps newer successes when editing an older version', () => {
    const initial = snapshot('처음');
    const first = addWorkRevision(startWork(initial), snapshot('첫 번째'), '첫 요청');
    const second = addWorkRevision(first, snapshot('두 번째'), '둘째 요청');
    const restored = selectWorkVersion(second, 1);
    expect(restored.current).toMatchObject(initial);
    expect(restored.versions).toBe(second.versions);

    const revised = addWorkRevision(restored, { ...initial, code: { ...initial.code, html: '세 번째' }, meta: null }, '새 요청');
    expect(revised.current).toMatchObject({ id: 4, parentId: 1, plan: initial.plan, photo: initial.photo, meta: null });
    expect(selectWorkVersion(revised, 3).current).toBe(second.current);
    expect(selectWorkVersion(revised, 99)).toBe(revised);
  });

  it('limits the list while keeping the initial work and the exact version just edited', () => {
    let history = startWork(snapshot('처음'));
    for (let n = 2; n <= 5; n++) history = addWorkRevision(history, snapshot(String(n)), String(n));
    history = selectWorkVersion(history, 2);
    history = addWorkRevision(history, snapshot('6'), '6');
    expect(history.versions.map(({ id }) => id)).toEqual([1, 2, 4, 5, 6]);
    expect(selectWorkVersion(history, history.current.parentId!).current.id).toBe(2);
  });
});
