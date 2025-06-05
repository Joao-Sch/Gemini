/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import entregas from "@/lib/entregas.json";
import motoBoys from "@/lib/motoboys.json";
//import users from "@/lib/users.json";
import Image from "next/image";
import "./SendButton.css";
import { IoDocumentAttachOutline } from "react-icons/io5";

//#region TIPOS
type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: string;
  type?: "text" | "delivery-form";
};

type Conversation = {
  id: string;
  messages: UIMessage[];
};

type Delivery = {
  nomeResponsavel: string;
  enderecoDestino: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    cep: string;
  };
  enderecoOrigem: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    cep: string;
  };
};

//#endregion

export default function Chat() {
  //#region States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [conversationCounter, setConversationCounter] = useState(1);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitClicked, setIsSubmitClicked] = useState(false);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [deliveryStep, setDeliveryStep] = useState<
    null | "destino" | "responsavel"
  >(null);
  const [pendingDelivery, setPendingDelivery] = useState<{
    enderecoDestino?: Delivery["enderecoDestino"];
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  //#endregion

  const ai = new GoogleGenAI({
    apiKey: "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ",
  });

  //#region Funções de Conversa
  const createNewConversation = () => {
    const newConv: Conversation = {
      id: `Conversa ${conversationCounter}`,
      messages: [],
    };
    setConversations((prev) => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    setConversationCounter((c) => c + 1);
  };

  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  });

  const switchConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  //#endregion

  //#region Funções de Input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentConversationId || isLoading) return;

    setIsSubmitClicked(true);
    setIsLoading(true);

    // Adiciona a mensagem do usuário ao chat
    const userMessage: UIMessage = {
      id: `user-message-${Date.now()}-${Math.random()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    );

    // LISTA DE ENTREGAS
    if (input.trim().toLowerCase() === "/listar-entregas") {
      sendResponse(
        deliveries.length === 0
          ? "Nenhuma entrega registrada."
          : deliveries
              .map(
                (d, i) =>
                  `Entrega ${i + 1}:
Responsável: ${d.nomeResponsavel}
Destino: ${d.enderecoDestino.rua}, ${d.enderecoDestino.numero}, ${
                    d.enderecoDestino.bairro
                  }, ${d.enderecoDestino.cidade}, ${d.enderecoDestino.cep}
Origem: ${d.enderecoOrigem.rua}, ${d.enderecoOrigem.numero}, ${
                    d.enderecoOrigem.bairro
                  }, ${d.enderecoOrigem.cidade}, ${d.enderecoOrigem.cep}`
              )
              .join("\n\n")
      );
      setInput("");
      setIsLoading(false);
      setIsSubmitClicked(false);
      return;
    }

    if (uploadedImages.length > 0) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: `user-message-${Date.now()}-${Math.random()}`,
                    role: "user",
                    content:
                      uploadedImages
                        .map((img) => `![image](${img})`)
                        .join("\n") + (input.trim() ? `\n${input.trim()}` : ""),
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : conv
        )
      );

      const response = await sendToGemini({
        text: input.trim() || undefined,
        image: uploadedImages[0],
      });

      sendResponse(response);

      setUploadedImages([]);
      setInput("");
      setTimeout(() => setIsSubmitClicked(false), 500);
      setIsLoading(false);
      return;
    }

    if (!input.trim()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await processUserInput(input);
      if (response && response.trim() !== "") {
        sendResponse(response);
      }
    } catch (error) {
      console.error("Erro ao processar a mensagem:", error);
      sendResponse("Desculpe, ocorreu um erro inesperado.");
    }

    setInput("");
    setTimeout(() => setIsSubmitClicked(false), 500);
    setIsLoading(false);
  };
  //#endregion

  //#region Função de Upload de Imagem
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Image = reader.result as string;
          setUploadedImages((prev) => [...prev, base64Image]);
        };
        reader.readAsDataURL(file);
      });
    }
  };
  //#endregion

  //#region Funções de Busca
  const fetchDeliveryDetails = (deliveryId: number) => {
    // Busca primeiro no entregas.json
    const found = (entregas as Record<string, any>)[String(deliveryId)];
    if (found) return found;
    return deliveries.find((d: any) => d.id === deliveryId);
  };

  const fecthDriverDetails = (driverId: number) => {
    return motoBoys.find((item) => item.id === driverId);
  };
  //#endregion

  //#region Funções do Gemini
  const sendToGemini = async (payload: { text?: string; image?: string }) => {
    try {
      const model = "gemini-2.0-flash";
      const contents = [
        {
          role: "user",
          parts: [
            ...(payload.image
              ? [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: payload.image.split(",")[1],
                    },
                  },
                ]
              : []),
            ...(payload.text
              ? [
                  {
                    text: payload.text,
                  },
                ]
              : []),
          ],
        },
      ];

      const response = await ai.models.generateContentStream({
        model,
        contents,
      });

      let partialMessage = "";

      for await (const chunk of response) {
        const text = chunk.text ?? "";
        partialMessage += text;
      }

      return partialMessage;
    } catch (error) {
      console.error("Erro ao enviar mensagem ao Gemini:", error);
      return "Desculpe, ocorreu um erro ao interagir com a IA. Tente novamente.";
    }
  };
  //#endregion

  //#region FUNÇÕES DE ENVIO DE ENVIO
  //#region Search Delivery
  const handleSearchDelivery = async (
    structuredResponse: any
  ): Promise<string> => {
    const deliveryId = parseInt(structuredResponse.event.correlation, 10);

    if (isNaN(deliveryId)) {
      return (
        structuredResponse.message || "Por favor, informe o ID da entrega."
      );
    }

    const deliveryDetails = fetchDeliveryDetails(deliveryId);
    if (deliveryDetails) {
      const origem = deliveryDetails.addresses.find(
        (a: any) => a.position === 0
      );
      const destino = deliveryDetails.addresses.find(
        (a: any) => a.position === 1
      );

      // Monta um prompt amigável para o Gemini
      const prompt = `
Aqui estão os detalhes da entrega:
- ID: ${deliveryDetails.id}
- Status: ${deliveryDetails.situation?.description ?? "N/A"}
- Origem: ${origem?.street ?? ""}, ${origem?.number ?? ""}, ${
        origem?.neighborhood ?? ""
      }, ${origem?.city ?? ""}, ${origem?.state ?? ""}, ${origem?.zipCode ?? ""}
- Responsável Origem: ${origem?.responsible ?? "N/A"}
- Destino: ${destino?.street ?? ""}, ${destino?.number ?? ""}, ${
        destino?.neighborhood ?? ""
      }, ${destino?.city ?? ""}, ${destino?.state ?? ""}, ${
        destino?.zipCode ?? ""
      }
- Responsável Destino: ${destino?.responsible ?? "N/A"}
- Motoboy: ${deliveryDetails.deliveryman?.name ?? "N/A"}
- Veículo: ${deliveryDetails.deliveryman?.vehicle?.model ?? "N/A"}
- Valor: R$ ${deliveryDetails.price ?? "N/A"}

Por favor, gere uma mensagem clara, amigável para o cliente com essas informações.
    `.trim();

      return await sendToGemini({ text: prompt });
    } else {
      return "Nenhuma entrega encontrada com o ID informado.";
    }
  };
  //#endregion

  //#region Search Driver
  const handleSearchDriver = async (
    structuredResponse: any
  ): Promise<string> => {
    const driverId = parseInt(structuredResponse.event.correlation, 10);

    if (isNaN(driverId)) {
      return (
        structuredResponse.message || "Please provide the delivery driver's ID."
      );
    }

    const driverDetails = fecthDriverDetails(driverId);

    if (driverDetails) {
      const prompt = `The client provided the delivery driver's ID: ${driverId}.
                      Here are the delivery driver's details: 
                      - Name: ${driverDetails.nome} 
                      - Phone: ${driverDetails.telefone} 
                      - Deliveries made: ${driverDetails.entregasRealizadas}
                      - Rating: ${driverDetails.avaliacao} 
                      Please format this response in a friendly and clear manner for the client.`;
      return await sendToGemini({ text: prompt });
    } else {
      return "Nenhum motboy encontrado com esse ID.";
    }
  };
  //#endregion
  //#endregion

  const generateRandomId = () => {
    return Math.floor(1000000 + Math.random() * 9000000);
  };

  //#endregion

  const handleInsertDelivery = async (
    structuredResponse: any
  ): Promise<string> => {
    const address = structuredResponse.event?.address;

    if (!address) {
      return "Por favor, informe o endereço completo.";
    }

    const newDelivery = {
      id: generateRandomId(),
      enderecoDestino: {
        rua: address.rua ?? "",
        numero: address.numero ?? "",
        bairro: address.bairro ?? "",
        cidade: address.cidade ?? "",
        cep: address.cep ?? "",
      },
      enderecoOrigem: {
        rua: "",
        numero: "",
        bairro: "",
        cidade: "",
        cep: "",
      },
    };

    setDeliveries((prev) => [...prev, newDelivery]);
    return `Entrega adicionada com sucesso para o endereço: ${address.rua}, ${address.numero}, ${address.bairro}, ${address.cidade}, ${address.cep}`;
  };

  //#region Funções de Processamento
  const processUserInput = async (userInput: string): Promise<string> => {
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
            },
          },
          message: { type: Type.STRING },
        },
      },
      systemInstruction: [
        {
          text: `# General
1 - You are a customer service bot, a point of support when the user needs to consult information at I9 Delivery.
2 - Event correlation is used to pass information related to the event, such as the delivery ID or the delivery driver's name.
3 - Always respond in Portuguese.
4 - Whenever the system passes information to you, it will be within 'data'.
5 - Never share someone's location; instead, use Euclidean distance to calculate the distance.

# Image Processing
1 - If the user sends an image, analyze it and include relevant details in your response.
2 - If the image contains text, transcribe it and include it in your response.
3 - If the image contains objects or scenes, describe them and relate them to the user's message.
4 - If both text and an image are provided, combine the information from both to generate a contextual response.
5 - If the image is irrelevant or cannot be processed, respond based on the text only.

# Delivery:
1 - Whenever a user asks about a delivery **and does not provide the delivery ID**, you MUST ask for the delivery ID. Your response should have the event code 'search_delivery' but the 'correlation' field should be empty or undefined, and the 'message' should clearly request the delivery ID.
2 - Whenever a user asks about a delivery **and provides the delivery ID**, use the event code: search_delivery and include the provided ID in the 'correlation' field.
3 - Whenever you need to consult information about a delivery, use the event code: search_delivery.

# Delivery Driver:
1 - Whenever a user asks about a delivery driver, request their ID of driver.
2 - Whenever you need to consult information about a delivery driver, use the event code: search_driver.

# Address Extraction
Whenever the user provides a Brazilian address (for delivery or pickup), ALWAYS extract the following fields: rua, numero, bairro, cidade, estado, cep.
- Always return these fields inside an "address" object within the "event" object in the JSON response, like this:
{
  "event": {
    "code": "insert_delivery",
    "address": {
      "rua": "...",
      "numero": "...",
      "bairro": "...",
      "cidade": "...",
      "estado": "...",
      "cep": "..."
    }
  },
  "message": "Endereço recebido!"
}
- If any field cannot be identified, return null for that field.
- Never return any explanation, just the JSON object.
- Example input: "R. José Maria dos Passos, 200 - Vila Padre Bento, Itu - SP, 02312-100"
- Example output: {"event":{"code":"insert_delivery","address":{"rua":"R. José Maria dos Passos","numero":"200","bairro":"Vila Padre Bento","cidade":"Itu","estado":"SP","cep":"02312-100"}},"message":"Endereço recebido!"}

# Adicionar Entrega:
1 - Se o usuário informar um endereço e um nome de responsável para uma nova entrega, use o event code: insert_delivery.
2 - Retorne o endereço extraído em 'address' e o nome do responsável em 'nomeResponsavel' dentro do objeto 'event'.
Exemplo de resposta:
{
  "event": {
    "code": "insert_delivery",
    "address": {
      "rua": "...",
      "numero": "...",
      "bairro": "...",
      "cidade": "...",
      "estado": "...",
      "cep": "..."
    },
    "nomeResponsavel": "Fulano de Tal"
  },
  "message": "Entrega registrada!"
}

# General Response:
1 - If the user's message is not related to deliveries or drivers, respond normally based on the context of the message.
2 - Use the event code: general_response for such cases.
3 - Ensure the response is friendly, clear, and concise.
`,
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

      let partialMessage = "";

      for await (const chunk of response) {
        const text = chunk.text ?? "";
        partialMessage += text;
      }

      if (!isValidJSON(partialMessage)) {
        console.warn(
          "Resposta do modelo não é JSON válido, tratando como texto:",
          partialMessage
        );
        return (
          partialMessage ||
          "Sorry, I couldn't process your request at the moment."
        );
      }

      const structuredResponse = JSON.parse(partialMessage);
      console.log("Structured model response:", structuredResponse);

      switch (structuredResponse.event?.code) {
        case "search_delivery":
          return await handleSearchDelivery(structuredResponse);

        case "search_driver":
          return await handleSearchDriver(structuredResponse);

        case "insert_delivery":
          return await handleInsertDelivery(structuredResponse);

        case "general_response":
        default:
          return (
            structuredResponse.message ||
            "Sorry, I couldn't understand your request."
          );
      }
    } catch (error) {
      console.error("Error processing model response:", error);
      return "Sorry, an error occurred while processing the response.";
    }
  };
  //#endregion

  //#region Função para validar JSON
  const isValidJSON = (text: string): boolean => {
    if (!text || text.trim() === "") return false;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };
  //#endregion

  //#region FUNÇÂO QUE MANDA A MENSAGEM DO BOT
  const sendResponse = (response: string) => {
    if (!currentConversationId) return;

    const botMessage: UIMessage = {
      id: `bot-message-${Date.now()}-${Math.random()}`,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, botMessage] }
          : conv
      )
    );

    let index = 0;
    const interval = setInterval(() => {
      if (index < response.length) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === currentConversationId) {
              const updatedMessages = conv.messages.map((msg) =>
                msg.id === botMessage.id
                  ? { ...msg, content: response.substring(0, index + 1) }
                  : msg
              );
              return { ...conv, messages: updatedMessages };
            }
            return conv;
          })
        );
        index++;
      } else {
        clearInterval(interval);
      }
    }, 20);
  };
  //#endregion

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation?.messages]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`sideBar w-64 bg-gray-250 shadow-md p-4 overflow-y-auto max-h-screen text-center transition-transform duration-300 ease-in-out "translate-x-0" : "-translate-x-full"
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
          className=" w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-500 mb-4"
        >
          Nova Conversa
        </button>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`slideConversation block w-full text-left px-4 py-2 rounded-md transition-all duration-500 ${
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
              className="slideLogo"
            />
          </div>
          <div className="h-[60vh] overflow-y-auto p-4 space-y-4 bg-chat-placeholder">
            {currentConversation &&
            currentConversation.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 translate-y-16">
                Envie uma mensagem para começar a conversa
              </div>
            ) : (
              currentConversation?.messages.map((m) => (
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
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.role === "user" && m.content.includes("data:image/")
                      ? m.content.split("\n").map((part, i) => {
                          const imageMatch = part.match(
                            /!\[image\]\((data:image\/[a-zA-Z]+;base64,[^\)]+)\)/
                          );
                          if (imageMatch) {
                            return (
                              <Image
                                key={i}
                                src={imageMatch[1]}
                                alt={`Imagem enviada pelo usuário ${i + 1}`}
                                width={200}
                                height={200}
                                className="imgUser rounded-md mb-4 mr-2"
                                unoptimized
                              />
                            );
                          }
                          return (
                            <p key={i} className="text-sm text-white">
                              {part}
                            </p>
                          );
                        })
                      : m.content.split("\n").map((line, i) => (
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
                    {m.role === "assistant" &&
                    m.content.includes("data:image/") ? (
                      <div className="flex flex-col mt-2">
                        {m.content.split("\n").map((part, i) => {
                          const imageMatch = part.match(
                            /!\[image\]\((data:image\/[a-zA-Z]+;base64,[^\)]+)\)/
                          );
                          if (imageMatch) {
                            return (
                              <Image
                                key={i}
                                src={imageMatch[1]}
                                alt={`Imagem enviada pela assistente ${i + 1}`}
                                width={200}
                                height={200}
                                className="imgAssistant rounded-md mb-4"
                                unoptimized
                              />
                            );
                          }
                          return null;
                        })}
                        {m.content.split("\n").map((line, i) => (
                          <span key={i} className="text-sm text-gray-800">
                            {line}
                            <br />
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />{" "}
            {/* Referência para o final das mensagens */}
          </div>
          <div className="border-t p-4">
            {/* Pré-visualização das imagens carregadas */}
            {uploadedImages.length > 0 && (
              <div className="flex space-x-2 mb-4 overflow-x-auto">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="relative">
                    <Image
                      src={image}
                      alt={`Imagem carregada ${index + 1}`}
                      width={50}
                      height={50}
                      className="rounded-md border border-gray-300"
                      unoptimized
                    />
                    <button
                      onClick={() =>
                        setUploadedImages((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário de entrada */}
            <form onSubmit={handleFormSubmit} className="flex w-full space-x-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Digite sua mensagem..."
                className="flex-grow bg-gray-100 p-2 border rounded-md focus:outline-none focus:border-green-800 transition-colors duration-600
                  click:bg-white transition-colors duration-500 focus:shadow-lg focus: shadow-gray-400 focus:scale-101 trasition-transition-all duration-700"
                disabled={isLoading}
              />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isLoading}
              />
              <label
                htmlFor="file-upload"
                className={`bg-gray-100 text-green-600 px-4 items-center py-2 border rounded-md cursor-pointer hover:bg-green-800 hover:text-white transition-colors duration-600 flex ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <IoDocumentAttachOutline size={20} />
              </label>
              <button
                type="submit"
                className={`bg-gray-100 border text-green-600 px-4 py-2 rounded-md cursor-pointer
                   ${
                     isLoading
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
                      <span>. </span>
                      <span>. </span>
                      <span>. </span>
                      <span>.</span>
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
//#endregion
