"use client";

import { useState } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import mockData from "@/lib/mockData.json";
import Image from "next/image";
import "./SendButton.css";

type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  messages: UIMessage[];
};

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationCounter, setConversationCounter] = useState(1);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitClicked, setIsSubmitClicked] = useState(false);

  const createNewConversation = () => {
    const newConv: Conversation = { id: `Conversa ${conversationCounter}`, messages: [] };
    setConversations((prev) => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    setConversationCounter((c) => c + 1);
  };

  const switchConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentConversationId || isLoading) return;

    setIsSubmitClicked(true);
    setIsLoading(true);

    // Adiciona a mensagem do usuário
    const userMessage: UIMessage = {
      id: `user-message-${Date.now()}`,
      role: "user",
      content: input,
    };
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    );

    try {
      const response = await processUserInput(input);
      sendResponse(response);
    } catch (error) {
      console.error("Erro ao processar a mensagem:", error);
      sendResponse("Desculpe, ocorreu um erro inesperado.");
    }

    setInput("");
    setTimeout(() => {
      setIsSubmitClicked(false);
    }, 500);
    setIsLoading(false);
  };

  const processUserInput = async (userInput: string) => {
    const ai = new GoogleGenAI({
      apiKey: "SUA_API_KEY", // Substitua pela sua chave de API válida
    });
  
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          relatedToDelivery: { type: Type.BOOLEAN },
          event: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              correlation: { type: Type.STRING },
              data: {
                type: Type.OBJECT,
                properties: {
                  meta: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
              },
            },
          },
          message: { type: Type.STRING },
        },
      },
      systemInstruction: [
        {
          text: `Você é um assistente especializado em entregas. 
          Sua tarefa é analisar a mensagem do usuário e determinar se ela está relacionada a entregas.
          - Se a mensagem estiver relacionada a entregas, extraia o ID da entrega, que é um número inteiro entre 1 e 999999.
          - Caso a mensagem não esteja relacionada a entregas, responda normalmente com base no contexto.
          - Responda de forma clara, amigável e útil.`,
        },
      ],
    };
  
    const model = "gemini-2.0-flash";
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: userInput,
          },
        ],
      },
    ];
  
    try {
      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });
  
      let partialMessage = ""; // Variável para armazenar a mensagem parcial
  
      // Adiciona uma mensagem vazia ao chat para exibir o streaming
      const botMessage: UIMessage = {
        id: `bot-message-${Date.now()}`,
        role: "assistant",
        content: "",
      };
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? { ...conv, messages: [...conv.messages, botMessage] }
            : conv
        )
      );
  
      for await (const chunk of response) {
        const text = chunk.text ?? ""; // Fallback para string vazia se chunk.text for undefined
        partialMessage += text;
  
        // Atualiza a mensagem parcial no chat
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === botMessage.id
                      ? { ...msg, content: partialMessage }
                      : msg
                  ),
                }
              : conv
          )
        );
      }
  
      return; // O streaming já atualizou a mensagem no chat
    } catch (error) {
      console.error("Erro ao processar a resposta do modelo:", error);
      sendResponse("Desculpe, ocorreu um erro ao processar a resposta.");
    }
  };

  const isValidJSON = (text: string) => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const sendResponse = (response: string) => {
    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}`,
      role: "assistant",
      content: response,
    };
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, botMessage] }
          : conv
      )
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`w-64 bg-gray-250 shadow-md p-4 overflow-y-auto max-h-screen text-center transition-transform duration-300 ease-in-out "translate-x-0" : "-translate-x-full"
          } sm:translate-x-0 sm:block`}
        style={{
          boxShadow: "16px 6px 11px -11px rgba(0,0,0,0.5)",
          WebkitBoxShadow: "16px 6px 11px -11px rgba(0,0,0,0.5)",
          MozBoxShadow: "16px 6px 11px -11px rgba(0,0,0,0.5)",
        }}
      >
        <div className="mb-4">
          <Image
            src="/fb-og.png"
            alt="Logo"
            width={150}
            height={150}
            className="mx-auto"
          />
        </div>

        <h2 className="text-lg font-bold mb-4">Conversas</h2>
        <button
          onClick={createNewConversation}
          className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-500 mb-4"
        >
          Nova Conversa
        </button>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`block w-full text-left px-4 py-2 rounded-md transition-all duration-500 ${conv.id === currentConversationId
                ? "bg-green-500 text-white scale-110"
                : "bg-gray-200 text-gray-800 hover:scale-105 hover:text-green-600"
                }`}
            >
              {conv.id}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div
          className="w-full max-w-2xl bg-white rounded-lg shadow-md overflow-hidden"
          style={{
            boxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
            WebkitBoxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
            MozBoxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
          }}
        >
          <div className="bg-green-600 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Chatbot I9</h1>
            <Image src="/logo_i9delivery.png" alt="chatbot" width={50} height={50} />
          </div>
          <div className="h-[60vh] overflow-y-auto p-4 space-y-4">
            {currentConversation && currentConversation.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Envie uma mensagem para começar a conversa
              </div>
            ) : (
              currentConversation?.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${m.role === "user" ? "bg-green-800 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                  >
                    {m.content.split("\n").map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t p-4">
            <form onSubmit={handleFormSubmit} className="flex w-full space-x-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Digite o ID da entrega ou pergunte algo..."
                className="flex-grow bg-gray-300 p-2 border rounded-md focus:outline-none focus:border-green-800 transition-colors duration-600
                  click:bg-white transition-colors duration-500 focus:shadow-lg focus: shadow-gray-400 focus:scale-101 trasition-transition-all duration-700"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`bg-gray-300 text-green-600 px-4 py-2 rounded-md cursor-pointer
                  ${isLoading
                    ? "bg-green-800 scale-105 text-white cursor-not-allowed"
                    : "hover:bg-green-800 hover:text-white transition-colors duration-600"
                  }
                `}
                disabled={isLoading}
              >
                {isSubmitClicked && !isLoading ? (
                  "Enviado"
                ) : isLoading ? (
                  <div className="wave-container-button">
                    <h1 className="wave-text-button">
                      <span>. </span><span>. </span><span>. </span><span>.</span>
                    </h1>
                  </div>
                ) : (
                  "Enviar"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}