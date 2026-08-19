import type { GeneratedCode } from '@/lib/ai/types';
import { downloadProgramZip } from './downloadZip';

// 게시물(또는 생성기 결과)에 대한 공용 액션. 공유·다운로드 로직이 여러 화면에
// 흩어지지 않게 한 곳에 모은다. 좋아요·신고 등 새 액션도 여기 붙인다.

type ToastFn = (msg: string, kind?: 'error' | 'success') => void;

/** 코드를 ZIP으로 받기 + 실패 시 안내 토스트(스스로 처리하므로 호출부는 await 불필요). photo가 있으면 __PHOTO__ 토큰을 실제 사진으로 치환해 담는다. */
export async function downloadProgram(code: GeneratedCode, title: string, toast: ToastFn, photo?: string): Promise<void> {
  try {
    await downloadProgramZip(code, title, photo);
  } catch (e) {
    console.error('ZIP 저장 실패:', e);
    toast('저장에 실패했어요. 잠시 후 다시 해주세요.');
  }
}

// 공유는 QR+주소 팝업(components/ui/ShareDialog)으로 통일 — 예전의 '주소만 클립보드 복사'
// 헬퍼(sharePostUrl)는 제거했다. 공유 URL 조립은 각 화면에서 직접 한다(카테고리·post id).
