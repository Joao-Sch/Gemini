"use client";

/*anotação de ideia, pegar uma atitude e uma longitude fixa,
  chumbar ela e tentar fazer um claculo com da media de tempo
  para o pedido chegar apartir da latitude e longitude passada
  no json dods motoboys
*/


import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mockData from "../lib/mockData.json";
import Image from "next/image";
import { IoMdMenu } from "react-icons/io";

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
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Estado para controlar a sidebar
  
  // Função para alternar a visibilidade da sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const generateResponse = async (prompt: string) => {
    const genAI = new GoogleGenerativeAI("AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      return "Desculpe, ocorreu um erro ao gerar a resposta.";
    }
  };

  const streamMessage = (message: string) => {
    setStreamingMessage(""); // Começa com uma mensagem vazia
    let index = 0;

    const interval = setInterval(() => {
      if (index < message.length) {
        setStreamingMessage((prev) => (prev || "") + message[index]);
        index++;
      } else {
        clearInterval(interval); // Para o intervalo quando a mensagem estiver completa
        setStreamingMessage(null); // Limpa o estado de streaming
        setIsLoading(false); // Permite enviar outra mensagem
      }
    }, 35); // Ajuste o tempo (em milissegundos) entre cada caractere
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

    let botMessageContent = "";

    // Extrair o ID da mensagem do usuário usando regex
    const idMatch = input.match(/\b\d+\b/); // Encontra o primeiro número na mensagem
    const id = idMatch ? parseInt(idMatch[0]) : NaN;

    switch (true) {
      case !isNaN(id): {
        // Caso o input contenha um número (possível ID)
        const entrega = mockData.find((item) => Number(item.id) === id);

        if (entrega) {
          // Dados da entrega encontrados
          const prompt = `Detalhes da entrega:\n- Situação: ${entrega.situacao}\n- Nome do Entregador: ${entrega.nomeEntregador}\n- Veículo: ${entrega.veiculo}\n- Valor: R$ ${entrega.valor}\n\nFormule uma resposta amigável com essas informações.`;
          botMessageContent = await generateResponse(prompt);
        } else {
          // ID não encontrado
          botMessageContent =
            "Desculpe, não consegui encontrar uma entrega com o ID fornecido. Poderia verificar o número?";
        }
        break;
      }
      case /entrega/i.test(input): {
        // Caso a mensagem seja sobre entrega, mas sem ID
        const prompt = `O usuário está perguntando sobre o status de uma entrega, mas não forneceu um ID. Responda de forma amigável e solicite o ID da entrega.`;
        botMessageContent = await generateResponse(prompt);
        break;
      }
      case input.trim().length > 0: {
        // Caso seja uma mensagem geral
        botMessageContent = await generateResponse(input);
        break;
      }
      default: {
        // Caso o input esteja vazio ou inválido
        botMessageContent = "Por favor, insira uma mensagem válida.";
        break;
      }
    }

    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}`,
      role: "assistant",
      content: botMessageContent,
    };

    // Inicie o efeito de streaming
    streamMessage(botMessageContent);

    // Adicione a mensagem completa ao estado após o streaming
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, botMessage] }
          : conv
      )
    );

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
      <link rel="stylesheet" href="./style.css" />
      {/* Sidebar */}
      <div
        className={`w-64 bg-gray-250 shadow-md p-4 overflow-y-auto max-h-screen text-center transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
            style={{
              marginBottom: "10px",
            }}
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

      {/* Toggle Sidebar Button */}
      <div className="sm:hidden absolute top-4 left-4 z-10">
        <button
          onClick={toggleSidebar}
          className="bg-gray-800 text-white p-2 rounded-full"
        >
          <IoMdMenu size={30} />
        </button>
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
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${m.role === "user"
                        ? "bg-green-800 text-white"
                        : "bg-gray-200 text-gray-800"
                      }`}
                  >
                    {m.role === "assistant" && index === currentConversation.messages.length - 1 && streamingMessage !== null
                      ? streamingMessage // Exibe a mensagem em streaming
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
                disabled={isLoading} // Desabilita o campo enquanto está carregando
              />
              <button
                type="submit"
                className={`bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-500 cursor-pointer ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"
                  }`}
                disabled={isLoading} // Desabilita o botão enquanto está carregando
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
