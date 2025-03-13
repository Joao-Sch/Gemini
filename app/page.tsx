"use client"

import { useChat } from "ai/react"
import { useState, useEffect } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Image from "next/image"

type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "data";
  content: string;
};

const Client = new GoogleGenerativeAI(
  "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ"
);

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()
  const [allMessages, setAllMessages] = useState<UIMessage[]>(messages);

  useEffect(() => {
    setAllMessages(messages);
  }, [messages]);

  const fetchBotMessage = async () => {
    const model = Client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const message = allMessages.map((m) => m.content).join("\n");
    const result = await model.generateContent(message);
    const botMessageContent = result.response.text();
    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}`,
      role: "assistant",
      content: botMessageContent,
    };
    setAllMessages((prevMessages) => [...prevMessages, botMessage]);

    // Salvar a mensagem do bot no banco de dados
    await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(botMessage),
    });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userMessage: UIMessage = {
      id: `user-message-${Date.now()}`,
      role: "user",
      content: input,
    };
    setAllMessages((prevMessages) => [...prevMessages, userMessage]);

    // Salvar a mensagem do usuário no banco de dados
    await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userMessage),
    });

    await handleSubmit(e);
    await fetchBotMessage();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-green-600 text-white p-4 flex justify-space-around aling-center gap-120" >
          <h1 className="text-xl font-bold">Chabot I9</h1>
         <Image
            src="/logo_i9delivery.png"
            alt="chatbot"
            width={50}                                                                                                                              
            height={50}
          />
        </div>
        <div className="h-[60vh] overflow-y-auto p-4 space-y-4">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Envie uma mensagem para começar a conversa
            </div>
          ) : (
            allMessages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    m.role === "user" ? "bg-green-800 text-white" : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {m.content}
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
              placeholder="Digite sua mensagem..."
              className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-500 cursor-pointer"
            >
              {isLoading ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}