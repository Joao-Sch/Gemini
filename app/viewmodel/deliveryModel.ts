/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function salvarEntregasNoFirebase(userId: string, deliveries: any[]) {
  await setDoc(doc(collection(db, "deliveries"), userId), { deliveries });
}

export async function carregarEntregasDoFirebase(userId: string): Promise<any[] | null> {
  const docSnap = await getDoc(doc(collection(db, "deliveries"), userId));
  if (docSnap.exists()) {
    return docSnap.data().deliveries as any[];
  }
  return null;
}

// Você pode adicionar outras funções relacionadas a entregas aqui