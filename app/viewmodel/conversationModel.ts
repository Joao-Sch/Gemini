import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation } from "../page"; // ajuste o caminho conforme necessário

export async function salvarConversasNoFirebase(userId: string, conversations: Conversation[]) {
  await setDoc(doc(collection(db, "conversations"), userId), { conversations });
}

export async function carregarConversasDoFirebase(userId: string): Promise<Conversation[] | null> {
  const docSnap = await getDoc(doc(collection(db, "conversations"), userId));
  if (docSnap.exists()) {
    return docSnap.data().conversations as Conversation[];
  }
  return null;
}