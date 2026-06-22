import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

interface Group {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  items: { reason: string; memo?: string; createdAt: number }[];
}

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const stuSnap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
    const studentUids = new Set(stuSnap.docs.map((d) => d.id));
    if (studentUids.size === 0) return NextResponse.json({ reports: [] });

    const repSnap = await adminDb.collection('reports').get();
    const groups = new Map<string, Group>();
    for (const d of repSnap.docs) {
      const r = d.data();
      const ownerUid = r.postOwnerUid as string | undefined;
      if (!ownerUid || !studentUids.has(ownerUid)) continue;
      const postId = r.postId as string;
      let g = groups.get(postId);
      if (!g) {
        g = {
          postId,
          postTitle: (r.postTitle as string) ?? '',
          postAuthorName: (r.postAuthorName as string) ?? '',
          postOwnerUid: ownerUid,
          items: [],
        };
        groups.set(postId, g);
      }
      g.items.push({
        reason: (r.reason as string) ?? '',
        ...(r.memo ? { memo: r.memo as string } : {}),
        createdAt: (r.createdAt as number) ?? 0,
      });
    }
    const reports = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
    return NextResponse.json({ reports });
  } catch (e) {
    console.error('교사 신고 조회 실패:', e);
    return NextResponse.json({ error: '신고를 불러오지 못했어요.' }, { status: 500 });
  }
}
