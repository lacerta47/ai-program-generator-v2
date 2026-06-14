// 한국 시간(KST) 기준 날짜 키. 호스트 타임존과 무관 — 절대 epoch(Date.now)에 +9h 후
// 항상 UTC로 출력하는 toISOString()을 쓰므로 서버/클라 어디서 돌든 동일.

/** 오늘(KST) 날짜 키 'YYYY-MM-DD' (자정에 한도 리셋). */
export function todayKeyKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 오늘 포함 최근 n일의 KST 날짜 키(오름차순: 가장 오래된 날 → 오늘). */
export function lastDayKeysKST(n: number): string[] {
  const base = Date.now() + 9 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(new Date(base - i * DAY).toISOString().slice(0, 10));
  }
  return keys;
}
