import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { putPreview } from '@/lib/preview-store';
import { verifyPin, allowShareAttempt } from '@/lib/server/sharePin';
import type { GeneratedCode } from '@/lib/ai/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  // 신뢰 가능한 클라 IP: Vercel이 세팅하는 x-real-ip 우선, 없으면 x-forwarded-for의 '마지막'(신뢰 프록시가 추가).
  // XFF의 [0](첫 값)은 클라가 위조 가능 → 요청마다 바꿔 레이트리밋을 우회할 수 있어 쓰지 않는다.
  const xff = req.headers.get('x-forwarded-for');
  const ip = (req.headers.get('x-real-ip') || (xff ? xff.split(',').pop() : '') || 'unknown').trim();
  if (!(await allowShareAttempt(postId, ip))) {
    return NextResponse.json({ error: '너무 여러 번 시도했어요. 잠시 후 다시 해주세요.' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '요청이 올바르지 않아요.' }, { status: 400 }); }
  const pin = String((body as { pin?: unknown })?.pin ?? '');

  const postSnap = await adminDb.collection('posts').doc(postId).get();
  const post = postSnap.data();
  const boardTeacherUid = post?.boardTeacherUid as string | undefined;
  if (!postSnap.exists || !boardTeacherUid) {
    return NextResponse.json({ error: '공유할 수 없는 작품이에요.' }, { status: 404 });
  }
  const tSnap = await adminDb.doc(`teachers/${boardTeacherUid}`).get();
  if (!verifyPin(pin, tSnap.data()?.viewPinHash as string | undefined)) {
    return NextResponse.json({ error: '관람 PIN이 맞지 않아요.' }, { status: 403 });
  }
  const code = post!.code as GeneratedCode;
  // 토큰 코드 + 사진을 저장하고 치환은 서빙 시점에(serve-time). post.code·post.photo는 rules로 이미 크기 검증됨.
  const previewId = await putPreview(code, post!.photo as string | undefined);
  return NextResponse.json({ previewId, title: (post!.title as string) ?? '작품', authorName: (post!.authorName as string) ?? '' });
}
