// '처음!' 축하(교육 Phase 2, #2B 후속) — 업로드 시 이 기기에서 처음 써본 개념을 가볍게 축하.
// 간단함 우선: 정확한 집계(도감=Firestore) 대신 localStorage 'seen' 집합으로 판정(읽기 0, 기기별).
// 첫 실행 시 이미 도감에 있던 개념을 한 번 더 축하할 수 있으나, 이후엔 정확. 딜라이트 용도라 이 정도로 충분.

const KEY = 'lun:concepts-seen';

/**
 * concepts 중 이 기기에서 처음 보는 것들을 반환하고, seen 집합에 추가(1회성).
 * localStorage 차단 환경이면 조용히 빈 배열.
 */
export function markFirstUse(concepts: string[]): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    const fresh = concepts.filter((c) => !seen.has(c));
    if (fresh.length) {
      fresh.forEach((c) => seen.add(c));
      localStorage.setItem(KEY, JSON.stringify([...seen]));
    }
    return fresh;
  } catch {
    return [];
  }
}
