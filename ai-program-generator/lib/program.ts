import type { GeneratedCode } from './ai/types';

/** iframe srcDoc 용: css/js를 인라인한 단일 HTML 문서 */
export function buildPreviewDoc(code: GeneratedCode): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${code.css}</style>
</head>
<body>
${code.html}
<script>${code.javascript}<\/script>
</body>
</html>`;
}

/** ZIP 다운로드 용: css/js를 외부 파일로 분리한 index.html */
export function buildIndexHtml(code: GeneratedCode, title: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'AI Generated Program'}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
${code.html}
<script src="script.js"></script>
</body>
</html>`;
}

/** 파일명에 안전한 슬러그로 변환 */
export function toSafeFileName(name: string): string {
  const slug = (name || 'program')
    .trim()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'program';
}
