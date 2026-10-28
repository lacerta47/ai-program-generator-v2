import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { PostWriteError, prepareNewPost } from '@/lib/server/postWrite';
import { ProfanityError } from '@/lib/moderation';
import { allowFixedWindow } from '@/lib/server/rateLimit';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  let user;
  try {
    user = await verifyActiveToken(token);
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
  try {
    if (!(await allowFixedWindow('postRate', user.uid, 10 * 60 * 1000, 30))) {
      return NextResponse.json({ error: '작품을 너무 자주 올리고 있어요. 잠시 후 다시 해 주세요.' }, { status: 429 });
    }
    const post = await prepareNewPost(await req.json(), user);
    const ref = await adminDb.collection('posts').add(post);
    return NextResponse.json({ id: ref.id });
  } catch (error) {
    if (error instanceof PostWriteError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ProfanityError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: '작품 정보가 올바르지 않아요.' }, { status: 400 });
    console.error('게시물 생성 실패:', error);
    return NextResponse.json({ error: '작품을 올리지 못했어요.' }, { status: 500 });
  }
}
