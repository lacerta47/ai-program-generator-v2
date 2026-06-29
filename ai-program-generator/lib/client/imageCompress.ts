/** File을 canvas로 최대 변 maxDim·JPEG quality로 압축한 data-URI 반환. 목표 크기 초과 시 quality 하향 재시도. */
export async function compressImage(file: File, maxDim = 768, maxChars = 160000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지를 처리할 수 없어요.');
    ctx.drawImage(bitmap, 0, 0, w, h);
    for (const q of [0.7, 0.55, 0.4]) {
      const uri = canvas.toDataURL('image/jpeg', q);
      if (uri.length <= maxChars) return uri;
    }
    throw new Error('사진이 너무 커요. 더 작은 사진으로 해볼까요?');
  } finally {
    bitmap.close(); // ImageBitmap 자원 해제(성공·실패 무관)
  }
}
