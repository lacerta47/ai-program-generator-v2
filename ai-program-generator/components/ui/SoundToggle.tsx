'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundOn, setSoundOn, playSelect } from '@/lib/client/sound';

export default function SoundToggle() {
  // SSR/하이드레이션: 초기엔 기본(on)으로 렌더, 마운트 후 실제 값으로 보정.
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(isSoundOn());
    // 다른 탭에서 바꾸면 아이콘도 따라가게 동기화.
    const onStorage = () => setOn(isSoundOn());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function toggle() {
    // 진실값(isSoundOn) 기준으로 뒤집는다 — 마운트 직후 아직 보정 전인 stale state로
    // 잘못 토글되는 창을 없앤다.
    const next = !isSoundOn();
    setSoundOn(next);
    setOn(next);
    if (next) playSelect(); // 켤 때 미리듣기
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? '소리 끄기' : '소리 켜기'}
      aria-pressed={on}
      title={on ? '소리 끄기' : '소리 켜기'}
      className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-line bg-surface text-ink hover:border-brand/50"
    >
      {on ? <Volume2 size={19} aria-hidden /> : <VolumeX size={19} aria-hidden />}
    </button>
  );
}
