import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Announcement } from '../types';

const collectionRef = () => collection(db, 'announcements');

export async function getAnnouncementsForTrainer(trainerId: string): Promise<Announcement[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Announcement)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createAnnouncement(
  data: Omit<Announcement, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function deleteAnnouncement(id: string) {
  await deleteDoc(doc(db, 'announcements', id));
}
