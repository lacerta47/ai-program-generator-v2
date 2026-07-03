'use client';

import { useEffect } from 'react';

// 방문 집계용 비콘 — 브라우저당 하루 1회만 /api/beacon을 친다(localStorage로 KST 날짜 dedup).
// 순수 fire-and-forget이라 실패해도 UX 영향 0. 렌더 출력 없음.
export default function VisitBeacon() {
  useEffect(() => {
    try {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // KST YYYY-MM-DD
      if (localStorage.getItem('lun_beacon_day') === today) return;
      localStorage.setItem('lun_beacon_day', today);
      fetch('/api/beacon', { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      /* localStorage 불가(사생활 모드 등) — 무시 */
    }
  }, []);
  return null;
}
