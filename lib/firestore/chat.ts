import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ChatMessage } from '../types';

const collectionRef = () => collection(db, 'messages');

/** Último mensaje de cada conversación de un entrenador, indexado por clientId. */
export async function getLastMessagesForTrainer(
  trainerId: string
): Promise<Map<string, ChatMessage>> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  const lastByClient = new Map<string, ChatMessage>();
  snap.docs.forEach((d) => {
    const message = { id: d.id, ...d.data() } as ChatMessage;
    const current = lastByClient.get(message.clientId);
    if (!current || message.createdAt > current.createdAt) {
      lastByClient.set(message.clientId, message);
    }
  });
  return lastByClient;
}

/** Se suscribe en tiempo real a la conversación de un cliente con su entrenador. */
export function subscribeToMessages(
  clientId: string,
  onChange: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)
      .sort((a, b) => a.createdAt - b.createdAt);
    onChange(messages);
  });
}

export async function sendMessage(data: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}
