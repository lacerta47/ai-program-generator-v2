import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { buildPreviewDoc } from '@/lib/program';
import { putPreview } from '@/lib/preview-store';
import { verifyPin, allowShareAttempt } from '@/lib/server/sharePin';
import type { GeneratedCode } from '@/lib/ai/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
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
  const previewId = await putPreview(buildPreviewDoc(code));
  return NextResponse.json({ previewId, title: (post!.title as string) ?? '작품', authorName: (post!.authorName as string) ?? '' });
}
