"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

  const genAI = new GoogleGenerativeAI("AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ");

  // Função para extrair o ID
  const extractDeliveryId = async (text: string): Promise<number | null> => {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
        Você é um especialista em chatbots de entrega.
        Quando receber uma mensagem, identifique se há um ID de entrega.
        Um ID de entrega é um número inteiro de 1 a 999999.
        Responda SOMENTE com o número do ID (por exemplo, "12345") se encontrar.
        Se não houver ID, responda exatamente "null".
      `,
    });

    try {
      const result = await model.generateContent(text);
      const raw = result.response.text().trim();
      const id = parseInt(raw, 10);
      return isNaN(id) ? null : id;
    } catch (error) {
      console.error("Erro ao extrair delivery ID:", error);
      return null;
    }
  };

  // Função principal do input
  const pocessUserInput = async (userInput: string) => {
    // Extrai o ID via Gemini
    const deliveryId = await extractDeliveryId(userInput);

    // Modelo para gerar a resposta final
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
            Você é um assistente especializado em entregas. 
            Quando o usuário falar algo sobre entregas, peça o ID caso ele não tenha fornecido,
            e tente ajudar com oque ele precisar em sua entrega.
            Quando receber um ID, o sistema irá fornecer os dados da entrega.
            Caso não tiver haver com entrega, você pode responder normalmente com base no contexto.
            sempre que o usuário falar sobre macacos, responda que ama o BOLSONARO E O FLAMENGO.
            Responda de forma clara e amigável, com emojis.
      `,
    });

    try {
      if (deliveryId !== null) {
        // Busca no mockData
        const delivery = mockData.find((item) => item.id === deliveryId);
        if (delivery) {
          // Monta o prompt com os dados do mockData
          const prompt = `
            O usuário forneceu o ID de entrega: ${delivery.id}.
            Aqui estão os dados da entrega:
            - Situação: ${delivery.situacao}
            - Nome do Entregador: ${delivery.nomeEntregador}
            - Veículo: ${delivery.veiculo}
            - Valor: R$ ${delivery.valor.toFixed(2)}
            - faça uma estimativa de tempo para a entrega usando
              a as coodernadas 23.554435 e -46.633308 com as coo
              rdenadas do motoboy: ${delivery.coordenadas}

            Com base nesses dados, responda de forma clara, organizada em tópicos e com emojis,
            incluindo uma estimativa de tempo de chegada (velocidade média 30 km/h).
          `;
          const result = await model.generateContent(prompt);
          return result.response.text();
        } else {
          return "❌ Entrega não encontrada. Verifique o ID e tente novamente.";
        }
      } else {
        // Sem ID, responde normalmente
        const result = await model.generateContent(userInput);
        return result.response.text();
      }
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      return "❌ Desculpe, ocorreu um erro ao processar sua mensagem.";
    }
  };

  // 3️⃣ Função para enviar a resposta do bot
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

  // Handlers de UI
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentConversationId || isLoading) return;

    setIsLoading(true);

    // Envia a mensagem do usuário
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
      const response = await pocessUserInput(input);
      sendResponse(response);
    } catch (error) {
      console.error("Erro ao processar a mensagem:", error);
      sendResponse("❌ Desculpe, ocorreu um erro inesperado.");
    }

    setInput("");
    setIsLoading(false);
  };

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
