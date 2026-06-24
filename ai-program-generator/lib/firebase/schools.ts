import { collection, getDocs } from 'firebase/firestore';
import { db } from './client';

export interface School {
  schoolCode: string;
  name: string;
}

export async function listSchools(): Promise<School[]> {
  const snap = await getDocs(collection(db, 'schools'));
  return snap.docs
    .map((d) => ({ schoolCode: d.id, name: (d.data().name as string) ?? d.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
