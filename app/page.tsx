"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Importa o SDK
import mockData from "../lib/mockData.json"; // Importa o JSON
import Image from "next/image";

type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
};

export default function Chat() {
  const [allMessages, setAllMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const generateResponse = async (prompt: string) => {
    const genAI = new GoogleGenerativeAI("AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ"); // Substitua pela sua chave
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Erro ao gerar resposta:", error);
      return "Desculpe, ocorreu um erro ao gerar a resposta.";
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const userMessage: UIMessage = {
      id: `user-message-${Date.now()}`,
      role: "user",
      content: input,
    };

    setAllMessages((prevMessages) => [...prevMessages, userMessage]);

    const id = parseInt(input.trim());
    let botMessageContent = "";

    if (!isNaN(id)) {
      // Buscar entrega pelo ID
      const entrega = mockData.find((item) => Number(item.id) === id);

      if (entrega) {
        const prompt = `Detalhes da entrega:\n- Situação: ${entrega.situacao}\n- Nome do Entregador: ${entrega.nomeEntregador}\n- Veículo: ${entrega.veiculo}\n- Valor: R$ ${entrega.valor}\n\nFormule uma resposta amigável com essas informações.`;
        botMessageContent = await generateResponse(prompt);
      } else {
        botMessageContent = "Por favor, forneça um ID válido para consultar a entrega.";
      }
    } else {
      botMessageContent = await generateResponse(input);
    }

    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}`,
      role: "assistant",
      content: botMessageContent,
    };

    setAllMessages((prevMessages) => [...prevMessages, botMessage]);
    setInput("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div
        className="w-full max-w-2xl bg-white rounded-lg shadow-md overflow-hidden"
        style={{
          boxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
          WebkitBoxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
          MozBoxShadow: "0px 10px 26px 14px rgba(176,176,176,0.75)",
        }}
      >
        <div className="bg-green-600 text-white p-4 flex justify-space-around aling-center gap-120">
          <h1 className="text-xl font-bold">Chatbot I9</h1>
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
                  {m.content.split("\n").map((line, index) => (
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
            />
            <button
              type="submit"
              className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-500 cursor-pointer"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}