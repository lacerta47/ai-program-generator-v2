import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function allUserCreationMs(): Promise<number[]> {
  const out: number[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const user of page.users) out.push(Date.parse(user.metadata.creationTime));
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

export async function countByCreatedAt(collection: 'posts' | 'reports', fromMs: number, toMs?: number): Promise<number> {
  let query = adminDb.collection(collection).where('createdAt', '>=', fromMs);
  if (toMs !== undefined) query = query.where('createdAt', '<', toMs);
  return (await query.count().get()).data().count;
}
