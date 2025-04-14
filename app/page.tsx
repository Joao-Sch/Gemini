"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mockData from "@/lib/mockData.json";
import Image from "next/image";
// import { IoMdMenu } from "react-icons/io";

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
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [conversationCounter, setConversationCounter] = useState(1);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Função para enviar a entrada do usuário para o Gemini
  const processUserInput = async (userInput: string) => {
    const genAI = new GoogleGenerativeAI(
      "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ"
    );
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
        Você é um assistente especializado em entregas. 
        Seu trabalho é:
        - Analise a mensagem do Cliente e determine se ela está relacionada
          a entregas ou se o cliente esta passando o id de uma entrega.
        - se A mensagem te haver com entrega peça gentilmente e usando emojis
          a cada palavra muitos emojis mesmo o id da entrega para o cliente
        - Se o cliente fornecer o ID, retorne o ID.  
        - Se o ID não for fornecido, solicitar o ID de forma amigável e com emojis.
        - Se a mensagem não estiver relacionada a entregas, responder normalmente com base no contexto da mensagem.
        - Sempre use emojis para tornar a resposta mais amigável.
      `,
    });

    try {
      const result = await model.generateContent(userInput);

      let response;
      try {
        // Tentar fazer o parse da resposta como JSON
        response = JSON.parse(result.response.text());
      } catch (error) {
        // Se não for JSON, tratar como texto puro
        console.warn(
          "Resposta não é um JSON válido. Retornando como texto puro."
        );
        return result.response.text();
      }

      // Usar switch para lidar com os diferentes casos
      switch (response.needsInfo) {
        case true:
          if (response.data && response.data.id) {
            // Buscar as informações no mockData
            const delivery = mockData.find(
              (item) => item.id === response.data.id
            );

            if (delivery) {
              // Retornar os dados no formato esperado
              const formattedData = {
                id: delivery.id,
                situacao: delivery.situacao,
                nomeEntregador: delivery.nomeEntregador,
                veiculo: delivery.veiculo,
                valor: delivery.valor,
                latitude: delivery.latitude,
                longitude: delivery.longitude,
              };

              return JSON.stringify({ data: formattedData });
            } else {
              return JSON.stringify({
                data: null,
                message: "ID não encontrado. Por favor, verifique o ID.",
              });
            }
          } else {
            return JSON.stringify({
              data: null,
              message: "Por favor, forneça mais informações para continuar.",
            });
          }

        case false:
          // Retornar a mensagem do Gemini
          return response.message;

        default:
          return "Desculpe, ocorreu um erro ao processar sua mensagem.";
      }
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      return "Desculpe, ocorreu um erro ao gerar a resposta.";
    }
  };
  // Função para enviar a resposta
  const sendResponse = async (response: string) => {
    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}`,
      role: "assistant",
      content: response,
    };

    streamMessage(response);

    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, botMessage] }
          : conv
      )
    );
  };

  const streamMessage = (message: string) => {
    setStreamingMessage("");
    let index = 0;

    const interval = setInterval(() => {
      if (index < message.length) {
        setStreamingMessage((prev) => (prev || "") + message[index]);
        index++;
      } else {
        clearInterval(interval);
        setStreamingMessage(null);
        setIsLoading(false);
      }
    }, 2.5);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentConversationId || isLoading) return;

    setIsLoading(true);

    const userMessage: UIMessage = {
      id: `user-message-${Date.now()}`,
      role: "user",
      content: input,
    };

    const updatedConversations = conversations.map((conv) => {
      if (conv.id === currentConversationId) {
        return {
          ...conv,
          messages: [...conv.messages, userMessage],
        };
      }
      return conv;
    });

    setConversations(updatedConversations);

    try {
      // Processar a entrada
      const response = await processUserInput(input);

      // Enviar a resposta
      await sendResponse(response);
    } catch (error) {
      console.error("Erro ao processar a mensagem:", error);
      await sendResponse(
        "Desculpe, ocorreu um erro ao processar sua mensagem."
      );
    }

    setInput("");
  };

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: `Conversa ${conversationCounter}`,
      messages: [],
    };
    setConversations((prev) => [...prev, newConversation]);
    setCurrentConversationId(newConversation.id);
    setConversationCounter((prev) => prev + 1);
  };

  const switchConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div
        className={`w-64 bg-gray-250 shadow-md p-4 overflow-y-auto max-h-screen text-center transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } sm:translate-x-0 sm:block`}
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
              className={`block w-full text-left px-4 py-2 rounded-md transition-all duration-500 ${
                conv.id === currentConversationId
                  ? "bg-green-500 text-white scale-110"
                  : "bg-gray-200 text-gray-800 hover:scale-105 hover:text-green-600"
              }`}
            >
              {conv.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-green-600 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Chatbot I9</h1>
            <Image
              src="/logo_i9delivery.png"
              alt="chatbot"
              width={50}
              height={50}
            />
          </div>
          <div className="h-[60vh] overflow-y-auto p-4 space-y-4">
            {currentConversation &&
            currentConversation.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Envie uma mensagem para começar a conversa
              </div>
            ) : (
              currentConversation?.messages.map((m, index) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      m.role === "user"
                        ? "bg-green-800 text-white"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {m.role === "assistant" &&
                    index === currentConversation.messages.length - 1 &&
                    streamingMessage !== null
                      ? streamingMessage
                      : m.content.split("\n").map((line, index) => (
                          <span key={index}>
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
                className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-500 cursor-pointer ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-green-700"
                }`}
                disabled={isLoading}
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
