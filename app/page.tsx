"use client";

import { useState } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import mockData from "@/lib/mockData.json"; // Dados simulados
import Image from "next/image";

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
    setIsLoading(false);
  };

  const processUserInput = async (userInput: string) => {
    const ai = new GoogleGenAI({
      apiKey: "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ",
    });
  
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
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
          Quando o usuário falar algo sobre entregas, peça o ID caso ele não tenha fornecido,
          e tente ajudar com o que ele precisar em sua entrega.
          Quando receber um ID, o sistema irá fornecer os dados da entrega.
          Caso não tiver haver com entrega, você pode responder normalmente com base no contexto.
          Responda de forma clara e amigável.`,
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
  
      let accumulatedText = ""; // Variável para acumular as partes do texto
  
      for await (const chunk of response) {
        // Garantir que chunk.text seja uma string
        const text = chunk.text ?? ""; // Fallback para string vazia se chunk.text for undefined
  
        // Acumular o texto recebido
        accumulatedText += text;
  
        // Logar o conteúdo acumulado para depuração
        console.log("Texto acumulado:", accumulatedText);
  
        // Verificar se o texto acumulado é um JSON válido
        if (!isValidJSON(accumulatedText)) {
          console.warn("Texto ainda não é um JSON válido. Aguardando mais partes...");
          continue; // Esperar por mais partes
        }
  
        // Fazer o parse do JSON completo
        const structuredResponse = JSON.parse(accumulatedText);
  
        if (structuredResponse.event?.data?.value) {
          const id = parseInt(structuredResponse.event.data.value, 10);
  
          // Busca no mockData
          const delivery = mockData.find((item) => item.id === id);
  
          if (delivery) {
            return `
              Detalhes da entrega:
              - Situação: ${delivery.situacao}
              - Nome do Entregador: ${delivery.nomeEntregador}
              - Veículo: ${delivery.veiculo}
              - Valor: R$ ${delivery.valor}
              - Localização do entregador: ${delivery.coordenadas}
  
              Se precisar de mais informações, é só falar comigo! 😊
            `;
          } else {
            return "ID não encontrado. Por favor, verifique o ID.";
          }
        } else {
          return structuredResponse.message || "Não consegui entender sua solicitação.";
        }
      }
    } catch (error) {
      console.error("Erro ao processar a resposta do modelo:", error);
      return "Desculpe, ocorreu um erro ao processar a resposta.";
    }
  };
  
  // Função para verificar se um texto é um JSON válido
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
      <div className="w-64 bg-white shadow-md p-4 overflow-y-auto max-h-screen text-center">
        <h2 className="text-lg font-bold mb-4">Conversas</h2>
        <button
          onClick={createNewConversation}
          className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 mb-4"
        >
          Nova Conversa
        </button>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`block w-full text-left px-4 py-2 rounded-md transition ${
                conv.id === currentConversationId
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {conv.id}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-md overflow-hidden">
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
                    className={`max-w-[80%] p-3 rounded-lg ${
                      m.role === "user" ? "bg-green-800 text-white" : "bg-gray-200 text-gray-800"
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
                className="flex-grow bg-gray-300 p-2 border rounded-md focus:outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`px-4 py-2 rounded-md ${
                  isLoading
                    ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}