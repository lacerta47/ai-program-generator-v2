import JSZip from 'jszip';
import type { GeneratedCode } from '@/lib/ai/types';
import { buildIndexHtml, toSafeFileName } from '@/lib/program';
import { substitutePhoto } from '@/lib/ai/photo';
import { tryFormat } from './formatCode';

/**
 * 생성된 코드를 index.html/style.css/script.js 로 묶어 ZIP 다운로드.
 * AI가 한 줄로 뭉쳐 준 코드도 파일에서는 읽기 좋게 Prettier로 정렬해 담는다(실패 시 원본).
 */
export async function downloadProgramZip(code: GeneratedCode, title: string, photo?: string): Promise<void> {
  const subCode = substitutePhoto(code, photo);
  const [indexHtml, styleCss, scriptJs] = await Promise.all([
    tryFormat(buildIndexHtml(subCode, title), 'html'),
    tryFormat(subCode.css, 'css'),
    tryFormat(subCode.javascript, 'javascript'),
  ]);

  const zip = new JSZip();
  zip.file('index.html', indexHtml);
  zip.file('style.css', styleCss);
  zip.file('script.js', scriptJs);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${toSafeFileName(title)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
