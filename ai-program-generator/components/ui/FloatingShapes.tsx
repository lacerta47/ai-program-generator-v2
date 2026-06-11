// 빈 화면 장식: 마스코트/이모지 대신 CSS 도형들이 부드럽게 떠다닌다.
// (장식 모션은 빈 상태에서만 — reduced-motion 시 globals.css 가드로 정지)
export default function FloatingShapes() {
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto h-28 w-48">
      <span
        className="absolute left-2 top-6 h-10 w-10 rounded-[12px] bg-brand-soft"
        style={{ animation: 'float-a 5.5s ease-in-out infinite' }}
      />
      <span
        className="absolute left-[72px] top-0 h-14 w-14 rounded-full bg-sunshine-soft border-2 border-sunshine/50"
        style={{ animation: 'float-b 6.5s ease-in-out infinite', animationDelay: '0.4s' }}
      />
      <span
        className="absolute right-6 top-9 h-9 w-9 rotate-12 rounded-[10px] bg-mint-soft border-2 border-mint/50"
        style={{ animation: 'float-a 6s ease-in-out infinite', animationDelay: '0.9s' }}
      />
      <span
        className="absolute bottom-0 left-[58px] h-0 w-0 border-x-[14px] border-b-[22px] border-x-transparent"
        style={{ borderBottomColor: 'var(--grape)', opacity: 0.45, animation: 'float-b 7s ease-in-out infinite', animationDelay: '1.3s' }}
      />
      <span
        className="absolute bottom-2 right-0 h-5 w-5 rounded-full bg-coral/40"
        style={{ animation: 'float-a 5s ease-in-out infinite', animationDelay: '1.7s' }}
      />
    </div>
  );
}
