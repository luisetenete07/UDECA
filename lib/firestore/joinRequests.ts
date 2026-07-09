import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { JoinRequest, UserProfile } from '../types';

/** Id determinista: una solicitud por (alumno, entrenador). */
const requestId = (clientId: string, trainerId: string) => `${clientId}_${trainerId}`;

/** El alumno envía (o reenvía) una solicitud para unirse a un entrenador. */
export async function sendJoinRequest(trainerId: string, client: UserProfile) {
  const id = requestId(client.uid, trainerId);
  const req: JoinRequest = stripUndefined({
    id,
    trainerId,
    clientId: client.uid,
    name: client.name,
    email: client.email,
    photoURL: client.photoURL,
    createdAt: Date.now(),
  }) as JoinRequest;
  await setDoc(doc(db, 'joinRequests', id), req);
}

/** Solicitudes que ha enviado un alumno (normalmente 0 o 1 pendiente). */
export async function getMyJoinRequests(clientId: string): Promise<JoinRequest[]> {
  const q = query(collection(db, 'joinRequests'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as JoinRequest);
}

/** Solicitudes pendientes recibidas por un entrenador. */
export async function getJoinRequestsForTrainer(trainerId: string): Promise<JoinRequest[]> {
  const q = query(collection(db, 'joinRequests'), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as JoinRequest)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** El entrenador aprueba: vincula al alumno y elimina la solicitud. */
export async function approveJoinRequest(req: JoinRequest) {
  await updateDoc(doc(db, 'users', req.clientId), { trainerId: req.trainerId });
  await deleteDoc(doc(db, 'joinRequests', req.id));
}

/** El entrenador rechaza (o el alumno cancela): borra la solicitud. */
export async function deleteJoinRequest(clientId: string, trainerId: string) {
  await deleteDoc(doc(db, 'joinRequests', requestId(clientId, trainerId)));
}
