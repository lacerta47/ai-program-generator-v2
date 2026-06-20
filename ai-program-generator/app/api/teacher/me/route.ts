import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const doc = await adminDb.doc(`teachers/${gate.uid}`).get();
  const d = doc.data() ?? {};
  return NextResponse.json({ name: (d.name as string) ?? '', totalQuota: (d.totalQuota as number) ?? 0 });
}
