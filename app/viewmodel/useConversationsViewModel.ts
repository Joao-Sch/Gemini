import { useState, useEffect } from "react";
import { salvarConversasNoFirebase, carregarConversasDoFirebase } from "./conversationModel";
import type { Conversation } from "../page"; // ajuste o caminho conforme necessário

export function useConversationsViewModel(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);

  useEffect(() => {
    async function loadConversations() {
      const conversasSalvas = await carregarConversasDoFirebase(userId);
      if (conversasSalvas) setConversations(conversasSalvas);
      setConversationsLoaded(true);
    }
    if (userId) loadConversations();
  }, [userId]);

  useEffect(() => {
    if (userId && conversationsLoaded) {
      salvarConversasNoFirebase(userId, conversations);
    }
  }, [conversations, userId, conversationsLoaded]);

  return {
    conversations,
    setConversations,
    conversationsLoaded,
  };
}