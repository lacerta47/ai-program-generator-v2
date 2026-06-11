// AI가 코드를 한 줄로 뭉쳐 반환하는 경우가 많아 표시/저장 전에 Prettier로 정렬.
// (prettier는 필요할 때만 lazy 로드 — 초기 번들에 미포함)
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function formatCode(code: string, language: string): Promise<string> {
  const prettier = await import('prettier/standalone');
  if (language === 'html') {
    const html: any = await import('prettier/plugins/html');
    return prettier.format(code, { parser: 'html', plugins: [html.default ?? html], printWidth: 90 });
  }
  if (language === 'css') {
    const postcss: any = await import('prettier/plugins/postcss');
    return prettier.format(code, { parser: 'css', plugins: [postcss.default ?? postcss] });
  }
  const babel: any = await import('prettier/plugins/babel');
  const estree: any = await import('prettier/plugins/estree');
  return prettier.format(code, {
    parser: 'babel',
    plugins: [babel.default ?? babel, estree.default ?? estree],
  });
}

/** 정렬 시도, 실패하면 원본 반환 */
export async function tryFormat(code: string, language: string): Promise<string> {
  if (!code) return code;
  try {
    return (await formatCode(code, language)).trimEnd();
  } catch {
    return code;
  }
}
