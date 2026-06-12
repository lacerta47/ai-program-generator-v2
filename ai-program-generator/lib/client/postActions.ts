import type { Post } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';
import { downloadProgramZip } from './downloadZip';

// 게시물(또는 생성기 결과)에 대한 공용 액션. 공유·다운로드 로직이 여러 화면에
// 흩어지지 않게 한 곳에 모은다. 좋아요·신고 등 새 액션도 여기 붙인다.

type ToastFn = (msg: string, kind?: 'error' | 'success') => void;

/** 코드를 ZIP으로 받기 + 실패 시 안내 토스트(스스로 처리하므로 호출부는 await 불필요). */
export async function downloadProgram(code: GeneratedCode, title: string, toast: ToastFn): Promise<void> {
  try {
    await downloadProgramZip(code, title);
  } catch (e) {
    console.error('ZIP 저장 실패:', e);
    toast('저장에 실패했어요. 잠시 후 다시 해주세요.');
  }
}

/** 게시물 공유 링크 복사 + 토스트. 성공 시 onCopied 콜백(복사 표시용). */
export async function sharePostUrl(
  post: Pick<Post, 'id' | 'categoryId'>,
  toast: ToastFn,
  onCopied?: () => void,
): Promise<void> {
  const url = `${window.location.origin}/board?category=${post.categoryId}&post=${post.id}`;
  try {
    await navigator.clipboard.writeText(url);
    onCopied?.();
    toast('작품 주소를 복사했어요! 친구들에게 자랑해 봐요', 'success');
  } catch {
    toast('링크 복사에 실패했어요.');
  }
}
