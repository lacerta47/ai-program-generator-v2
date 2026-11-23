import type { GeneratedCode, GenerationMeta } from '@/lib/ai/types';
import type { PlanFields } from '@/lib/firebase/types';

export interface WorkSnapshot {
  code: GeneratedCode;
  plan: PlanFields;
  genPrompt: string;
  photo: string | null;
  meta: Partial<GenerationMeta> | null;
}

export interface WorkVersion extends WorkSnapshot {
  id: number;
  parentId: number | null;
  request: string | null;
}

export interface WorkHistory {
  versions: WorkVersion[];
  current: WorkVersion;
}

export function startWork(snapshot: WorkSnapshot): WorkHistory {
  const current = { ...snapshot, id: 1, parentId: null, request: null };
  return { current, versions: [current] };
}

export function addWorkRevision(history: WorkHistory, snapshot: WorkSnapshot, request: string): WorkHistory {
  const base = history.current;
  const versions = history.versions;
  const current = { ...snapshot, id: versions[versions.length - 1].id + 1, parentId: base.id, request };
  // 처음 작품과 방금 고치기 전의 작품은 남겨 즉시 되돌릴 수 있게 한다.
  const recent = versions.slice(1).filter((version) => version.id !== base.id);
  const keep = new Set(recent.slice(base.id === 1 ? -3 : -2).map((version) => version.id));
  return {
    current,
    versions: [...versions.filter((version) => version.id === 1 || version.id === base.id || keep.has(version.id)), current],
  };
}

export function selectWorkVersion(history: WorkHistory, id: number): WorkHistory {
  const current = history.versions.find((version) => version.id === id);
  return current && current !== history.current ? { ...history, current } : history;
}
