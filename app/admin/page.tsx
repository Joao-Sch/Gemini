"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  doc,
} from "firebase/firestore";

type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: string;
  type?: "text" | "delivery-form";
};

type Conversation = {
  id: string;
  title: string;
  messages: UIMessage[];
  participantes?: string[];
  participantesInfo?: {
    bot?: {
      avatarUrl?: string;
      displayName?: string;
    };
    user?: {
      avatarUrl?: string;
      displayName?: string;
    };
  };
};

export default function AdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const [inputAdmin, setInputAdmin] = useState("");
  const placeholderInterval = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const messageUnsubsRef = useRef<{ [convId: string]: () => void }>({});
  const [assumindoComoBot, setAssumindoComoBot] = useState(false);

  // Redireciona se não for admin
  useEffect(() => {
    if (typeof window !== "undefined") {
      const profile = localStorage.getItem("profileType");
      if (profile !== "admin") router.replace("/");
    }
  }, [router]);

  // Carrega conversas do usuário demo
  useEffect(() => {
    // Busca todas as conversas (ajuste o filtro se quiser mais de um user)
    const q = query(collection(db, "conversations"), where("userId", "==", "demo"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const convs: Conversation[] = [];
      // Limpa listeners antigos
      Object.values(messageUnsubsRef.current).forEach(unsub => unsub());
      messageUnsubsRef.current = {};

      querySnapshot.forEach((docSnap) => {
        const convData = docSnap.data();
        const convId = docSnap.id;
        convs.push({
          ...(convData as Omit<Conversation, "messages">),
          id: convId,
          messages: [],
        });
      });

      setConversations(convs);

      // Para cada conversa, escuta as mensagens em tempo real
      convs.forEach((conv) => {
        const messagesCol = collection(db, "conversations", conv.id, "messages");
        const unsubMsg = onSnapshot(messagesCol, (messagesSnap) => {
          setConversations((prevConvs) =>
            prevConvs.map((c) =>
              c.id === conv.id
                ? {
                    ...c,
                    messages: messagesSnap.docs
                      .map((msg) => msg.data() as UIMessage)
                      .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "")),
                  }
                : c
            )
          );
        });
        messageUnsubsRef.current[conv.id] = unsubMsg;
      });

      // Seleciona a primeira conversa se nenhuma estiver selecionada
      if (convs.length > 0 && !currentConversationId) setCurrentConversationId(convs[0].id);
    });

    return () => {
      unsubscribe();
      Object.values(messageUnsubsRef.current).forEach(unsub => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  const switchConversation = (id: string) => setCurrentConversationId(id);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const participantesInfo = currentConversation?.participantesInfo || {};

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation?.messages]);

  // Placeholder animado
  const animatePlaceholder = (text: string) => {
    setSearchPlaceholder("");
    let i = 0;
    if (placeholderInterval.current) clearInterval(placeholderInterval.current);
    placeholderInterval.current = setInterval(() => {
      setSearchPlaceholder((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        if (placeholderInterval.current)
          clearInterval(placeholderInterval.current);
      }
    }, 60);
  };

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (!currentConversationId) return;
    const unsub = onSnapshot(
      doc(db, "conversations", currentConversationId),
      (docSnap) => {
        setAssumindoComoBot(docSnap.data()?.isBotPaused ?? false);
      }
    );
    return () => unsub();
  }, [currentConversationId]);

  return (
    <div
      className={`flex min-h-screen w-full ${
        darkMode ? "bg-[#222]" : "bg-blue-50"
      }`}
    >
      {/* Sidebar */}
      <div
        className={`
          sideBar
          w-4/5 max-w-xs
          fixed sm:static
          top-0 left-0 h-full z-50
          shadow-md p-4
          overflow-y-hidden
          transition-transform duration-300 
          -translate-x-full
          sm:translate-x-0 sm:w-64 sm:h-auto sm:shadow-md
          ${sidebarOpen ? "translate-x-0" : ""}
          relative
          ${sidebarOpen ? "w-full max-w-full" : ""}
        `}
        style={{
          boxShadow: darkMode
            ? "0 2px 8px 0 rgba(0,0,0,0.7)"
            : "16px 6px 11px -11px rgba(0,0,0,0.5)",
        }}
      >
        <div className="mb-4 relative flex items-center justify-center">
          <Image
            src={darkMode ? "/i9White.png" : "/fb-og.png"}
            alt="Logo"
            width={150}
            height={150}
            className="mx-auto transition-transform duration-300 hover:scale-110 cursor-pointer"
          />
        </div>
        <h2 className="text-lg font-bold mb-4 text-center text-blue-700 dark:text-blue-200">Conversas do Usuário</h2>
        <div className="relative mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              animatePlaceholder("Buscar conversa");
            }}
            onBlur={() => {
              setSearchFocused(false);
              setSearchPlaceholder("");
              if (placeholderInterval.current)
                clearInterval(placeholderInterval.current);
            }}
            placeholder={searchFocused ? searchPlaceholder : ""}
            className={`
              w-full
              pl-4 pr-4
              border rounded-md
              focus:outline-none
              transition-all duration-500
              ${
                darkMode
                  ? "bg-[#222] text-gray-100 placeholder-gray-400"
                  : "bg-white text-gray-900 placeholder-gray-400"
              }
              ${searchFocused ? "h-12 border-blue-700" : "h-8 border-gray-300"}
            `}
            style={{
              transitionProperty: "height, border-color",
              minHeight: "2rem",
              maxHeight: "3rem",
            }}
          />
        </div>
        <div
          className="space-y-2 rounded-lg my-2 custom-scrollbar"
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "12px",
          }}
        >
          {conversations
            .filter((conv) =>
              conv.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((conv) => (
              <button
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`slideConversation block w-full px-4 py-2 rounded-md text-center
                  transition-all duration-500 transition-colors
                  ${
                    conv.id === currentConversationId
                      ? darkMode
                        ? "bg-blue-900 text-white scale-110"
                        : "bg-blue-600 text-white scale-110"
                      : darkMode
                      ? "bg-gray-800 text-gray-100 hover:scale-105 hover:text-blue-400"
                      : "bg-gray-200 text-gray-800 hover:scale-105 hover:text-blue-600"
                  }
                `}
              >
                <b>{conv.title}</b>
              </button>
            ))}
        </div>
        {/* Botão de alternar tema */}
        <div className="absolute bottom-4 left-0 w-full justify-center hidden sm:flex">
          <button
            onClick={() => setDarkMode((prev) => !prev)}
            className={`
              w-14 h-7 flex items-center rounded-full p-1
              transition-colors duration-500
              ${darkMode ? "bg-blue-900" : "bg-gray-300"}
            `}
            aria-label="Alternar modo escuro"
          >
            <div
              className={`
                w-6 h-6 rounded-full bg-white shadow-md transform
                transition-transform duration-300 flex items-center justify-center
                ${darkMode ? "translate-x-7" : "translate-x-0"}
              `}
            >
              {darkMode ? (
                <span
                  role="img"
                  aria-label="Lua"
                  className="text-yellow-400 text-lg transition-colors duration-500"
                >
                  🌙
                </span>
              ) : (
                <span
                  role="img"
                  aria-label="Sol"
                  className="text-yellow-500 text-lg transition-colors duration-500"
                >
                  ☀️
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
      {/* Chat principal */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] sm:h-[90vh] sm:max-w-2xl mx-auto">
        <div
          className={`
            flex flex-col w-full h-full
            sm:rounded-lg sm:shadow-md
            overflow-hidden
            ${
              darkMode ? "bg-[#222] text-white" : "bg-blue-50 text-gray-800"
            }
          `}
          style={{
            boxShadow: darkMode
              ? "0px 10px 26px 14px rgba(0,0,0,0.7)"
              : "0px 10px 26px 14px rgba(176,176,255,0.25)",
          }}
        >
          {/* Header */}
          <div
            className={`
              ${darkMode ? "bg-blue-900" : "bg-blue-600"}
              text-white p-4 flex items-center justify-center relative transition-colors duration-500 shrink-0
            `}
          >
            {/* Botão hambúrguer só no mobile */}
            <button
              className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 bg-transparent p-1"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Abrir menu"
            >
              <svg width="28" height="28" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 8h20M4 16h20"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold w-full text-center">
              Central/Admin - Conversas do Usuário
            </h1>
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Image
                src="/logo_i9delivery.png"
                alt="chatbot"
                width={40}
                height={40}
                className="slideLogo"
              />
            </div>
          </div>
          {/* Mensagens */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-chat-placeholder">
              {currentConversation &&
              currentConversation.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full" style={{ marginTop: "12px"}}>
                  <span className="text-xl font-bold text-blue-700 px-6 py-4 ">
                    Envie uma mensagem para começar a conversa
                  </span>
                </div>
              ) : (
                currentConversation?.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.role === "assistant" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="relative max-w-[80%] sm:max-w-[75%]">
                      <Image
                        src={
                          m.role === "assistant"
                            ? "/roboIcon-admin.png"
                            : participantesInfo.user?.avatarUrl || "/default-user.png"
                        }
                        alt={m.role === "assistant" ? "Bot Avatar" : "User Avatar"}
                        width={32}
                        height={32}
                        className={`
                          rounded-full
                          absolute
                          z-20
                          shadow
                          ${
                            m.role === "assistant"
                              ? darkMode
                                ? "ring-2 ring-blue-900 bg-blue-900 right-3 -top-4"
                                : "ring-2 ring-blue-600 bg-blue-600 right-3 -top-4"
                              : darkMode
                              ? "ring-2 ring-[#222] bg-[#222] left-3 -top-4"
                              : "ring-2 ring-blue-50 bg-blue-50 left-3 -top-4"
                          }
                        `}
                        style={{
                          background:
                            m.role === "assistant"
                              ? darkMode
                                ? "#222"
                                : "#ffffff"
                              : darkMode
                              ? "#222"
                              : "#e0e7ff",
                        }}
                        unoptimized
                      />
                      <div
                        className={`
                          relative z-10 p-3 rounded-lg break-words
                          transition-colors duration-500
                          ${
                            m.role === "assistant"
                              ? darkMode
                                ? "bg-blue-900 text-white"
                                : "bg-blue-800 text-white"
                              : darkMode
                              ? "bg-gray-800 text-gray-100"
                              : "bg-gray-100 text-gray-600"
                          }
                        `}
                        style={{ paddingTop: "1.5rem" }}
                      >
                        {(typeof m.content === "string" ? m.content : "")
                          .split("\n")
                          .map((line, i) => (
                            <span key={i}>
                              {line}
                              <br />
                            </span>
                          ))}
                        {m.timestamp && (
                          <span className="text-xs text-gray-400 block mt-1">
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {currentConversation && (
  <div className="flex justify-end p-2">
    <button
      onClick={async () => {
        const newState = !assumindoComoBot;
        setAssumindoComoBot(newState);
        if (currentConversationId) {
          await setDoc(
            doc(db, "conversations", currentConversationId),
            { isBotPaused: newState },
            { merge: true }
          );
        }
      }}
      className={`px-4 py-2 rounded font-bold transition
        ${assumindoComoBot
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-blue-600 text-white hover:bg-blue-700"}
      `}
    >
      {assumindoComoBot ? "Parar de responder como Bot" : "Assumir como Bot"}
    </button>
  </div>
)}
{assumindoComoBot && (
  <form
    onSubmit={async (e) => {
      e.preventDefault();
      if (!inputAdmin.trim() || !currentConversationId) return;
      // Envia mensagem como "assistant"
      const botMessage: UIMessage = {
        id: `admin-bot-message-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: inputAdmin,
        timestamp: new Date().toISOString(),
      };
      // Salva no Firestore (ou atualiza o estado, conforme seu fluxo)
      await setDoc(
        doc(
          db,
          "conversations",
          currentConversationId,
          "messages",
          botMessage.id
        ),
        botMessage
      );
      setInputAdmin("");
    }}
    className="flex gap-2 p-2"
  >
    <input
      value={inputAdmin}
      onChange={(e) => setInputAdmin(e.target.value)}
      className="flex-1 border rounded px-3 py-2"
      placeholder="Responder como Bot..."
    />
    <button
      type="submit"
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      Enviar
    </button>
  </form>
)}
        </div>
      </div>
    </div>
  );
}