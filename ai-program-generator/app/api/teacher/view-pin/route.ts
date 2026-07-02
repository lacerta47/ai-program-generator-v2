import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { adminDb } from '@/lib/firebase/admin';
import { hashPin, isValidPinFormat } from '@/lib/server/sharePin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const snap = await adminDb.doc(`teachers/${gate.uid}`).get();
  return NextResponse.json({ hasPin: !!snap.data()?.viewPinHash });
}

export async function POST(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '요청이 올바르지 않아요.' }, { status: 400 }); }
  const pin = String((body as { pin?: unknown })?.pin ?? '');
  if (!isValidPinFormat(pin)) return NextResponse.json({ error: '관람 PIN은 숫자 6~8자리예요.' }, { status: 400 });
  await adminDb.doc(`teachers/${gate.uid}`).set({ viewPinHash: hashPin(pin) }, { merge: true });
  return NextResponse.json({ ok: true });
}
