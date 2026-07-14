// 미리보기를 "교차 사이트" URL로 로드해 별도 프로세스에서 실행하기 위한 오리진 계산(공유).
// (srcDoc은 부모와 같은 프로세스라, 생성 코드의 무한 루프가 탭 전체를 얼렸음 — 실제 발생 버그)
// localhost ↔ 127.0.0.1 은 서로 다른 사이트라 Chrome 사이트 격리가 적용된다.
// 배포(비-localhost)인데 별도 미리보기 도메인 미설정 = 프로세스 격리 불가 → 같은 오리진으로
// 조용히 폴백하지 않고 명시적으로 throw(호출부가 fail-closed 처리). 배포 시 NEXT_PUBLIC_PREVIEW_ORIGIN 필수.
// ※ 두 소비자(FullscreenFrame·/share)가 이 한 소스를 공유 — 폴백 정책이 다시 어긋나지 않도록.
export function previewOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  const configured = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  if (!configured) {
    console.error('[preview] NEXT_PUBLIC_PREVIEW_ORIGIN 미설정 — 미리보기 비활성화(프로세스 격리 불가).');
    throw new Error('PREVIEW_ORIGIN_UNSET');
  }
  return configured;
}
