"use client";

import { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import entregas from "@/lib/entregas.json";
import motoBoys from "@/lib/motoboys.json";
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
  enderecoOrigem?: {
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
  const [deliveries, setDeliveries] = useState<Delivery[]>([]); // Lista de entregas
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [pendingDelivery, setPendingDelivery] = useState<any>(null);

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
      createNewConversation(); // Cria a conversa inicial
    }
  }, []);

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

    if (input.trim().toLowerCase() === "/listar-entregas") {
      sendResponse(
        deliveries.length === 0
          ? "Nenhuma entrega registrada."
          : deliveries
              .map(
                (d, i) =>
                  `Entrega ${i + 1}: ${d.nomeResponsavel}, Destino: ${
                    d.enderecoDestino?.rua
                  }, ${d.enderecoDestino?.numero}, ${
                    d.enderecoDestino?.bairro
                  }, ${d.enderecoDestino?.cidade}, ${d.enderecoDestino?.cep}`
              )
              .join("\n")
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

    // Caso contrário, fluxo normal de texto
    if (!input.trim()) {
      setIsLoading(false);
      return;
    }

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

    try {
      const response = await processUserInput(input);
      // Só envia resposta se não for string vazia
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
        reader.readAsDataURL(file); // Garante que o formato seja data:image/...
      });
    }
  };
  //#endregion
  //#endregion

  //#region Funções de Busca
  const fetchDeliveryDetails = (deliveryId: number) => {
    return entregas[1497102];
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
      const errorMessage =
        "Desculpe, ocorreu um erro ao interagir com a IA. Tente novamente.";
      return errorMessage;
    }
  };
  //#endregion


  //#region FUNÇÕES DE ENVIO DE ENVIO
  //#region Search Delivery
  const handleSearchDelivery = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    structuredResponse: any
  ): Promise<string> => {
    const deliveryId = parseInt(structuredResponse.event.correlation, 10);

    if (isNaN(deliveryId)) {
      return structuredResponse.message || "Please provide the delivery ID.";
    }

    const deliveryDetails = fetchDeliveryDetails(deliveryId);
    if (deliveryDetails) {
      const prompt = `
    The client provided the delivery ID: ${deliveryId}.
    Here are the delivery details:
    - Status: ${deliveryDetails.situacao}
    - Delivery Person's Name: ${deliveryDetails.nomeEntregador}
    - Vehicle: ${deliveryDetails.veiculo}
    - Value: $${deliveryDetails.valor.toFixed(2)}
    - Delivery Estimate: calculate the Euclidean distance between the origin point and the delivery point and provide the delivery estimate in minutes based on the delivery person's location ${
      deliveryDetails.coordenadas
    } and the client's location which is always "latitude": -23.55052, "longitude": -46.633308. Only provide the estimated time without giving details of how it was calculated.

    Please generate a friendly and clear response for the client.`;
      return await sendToGemini({ text: prompt });
    } else {
      return "No delivery found with the provided ID.";
    }
  };
  //#endregion
  //#region Search Driver
  const handleSearchDriver = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      return await sendToGemini(prompt);
    } else {
      return "No delivery driver found with the provided ID.";
    }
  };
  //#endregion
  //#endregion

  //#region FUNÇÕES DE INSERÇÃO DE ENTREGA
  //#region Insert Delivery
  const handleInsertDelivery = (deliveryJson: string | object) => {
    let deliveryData;
    try {
      if (typeof deliveryJson === "object" && deliveryJson !== null) {
        deliveryData = deliveryJson;
      } else if (typeof deliveryJson === "string") {
        const jsonMatch = deliveryJson.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          deliveryData = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      return "Desculpe, não consegui entender o endereço. Por favor, tente novamente.";
    }

    if (!deliveryData || typeof deliveryData !== "object") {
      // Só retorna erro se realmente tentou processar um JSON
      return "";
    }

    // Normaliza os campos para aceitar tanto PT quanto EN
    const rua = deliveryData.rua || deliveryData.street;
    const numero = deliveryData.numero || deliveryData.number;
    const bairro = deliveryData.bairro || deliveryData.neighborhood;
    const cidade = deliveryData.cidade || deliveryData.city || "";
    const cep = deliveryData.cep || deliveryData.zip || "";
    const responsavel = deliveryData.responsavel || deliveryData.responsible;

    // Se só veio o endereço, guarda e espera o responsável
    if (rua && numero && bairro && !responsavel) {
      setPendingDelivery({ rua, numero, bairro, cidade, cep });
      return "";
    }

    // Se temos endereço pendente e agora veio o responsável
    if (pendingDelivery && responsavel) {
      setDeliveries((prev) => [
        ...prev,
        {
          nomeResponsavel: responsavel,
          enderecoDestino: {
            rua: pendingDelivery.rua,
            numero: pendingDelivery.numero,
            bairro: pendingDelivery.bairro,
            cidade: pendingDelivery.cidade,
            cep: pendingDelivery.cep,
          },
        },
      ]);
      setPendingDelivery(null);
      return "Entrega registrada com sucesso! ✅";
    }

    // Caso venha tudo junto (endereço + responsável)
    if (rua && numero && bairro && responsavel) {
      setDeliveries((prev) => [
        ...prev,
        {
          nomeResponsavel: responsavel,
          enderecoDestino: {
            rua,
            numero,
            bairro,
            cidade,
            cep,
          },
        },
      ]);
      return "Entrega registrada com sucesso! ✅";
    }

    return "";
  };
  //#endregion
  //#endregion

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
3 - Always respond in the same language as the user's message.
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

# Insert Delivery:
1. When the user wants to add a delivery, first ask: "What is the delivery address?".
2. When the user provides the address, extract and return the following fields as JSON:
   - street
   - number
   - neighborhood
   - city (if present)
   - zip (if present)
   Example:
   {
     "street": "R. São João",
     "number": "397",
     "neighborhood": "Vila Sao Francisco",
     "city": "",
     "zip": ""
   }
3. After receiving the address, ask: "Who is the person responsible for the delivery?".
4. When the user provides the name, return it as JSON:
   Example:
   {
     "responsible": "João"
   }
5. When all information is collected, confirm the registration and add the delivery to the list.
6. Always validate that all required fields are present before confirming the registration.
7. Only confirm the registration when all information is complete.

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
          // Só envia resposta se houver mensagem
          const msg = handleInsertDelivery(structuredResponse.message);
          if (msg) return msg;
          return "";
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
      content: "", // Começa vazio para o efeito de digitação
      timestamp: new Date().toISOString(),
    };

    // Adiciona a mensagem do bot (vazia inicialmente)
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, botMessage] }
          : conv
      )
    );

    // Efeito de digitação
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
    }, 20); // Ajuste a velocidade da "digitação" aqui (em ms)
  };
  //#endregion

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
                    {m.role === "user" && m.content.includes("data:image/") ? (
                      m.content.split("\n").map((part, i) => {
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
                    ) : (
                      m.content.split("\n").map((line, i) => (
                        <span key={i}>
                          {line}
                          <br />
                        </span>
                      ))
                    )}
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
              ))
            )}
          </div>
          <div className="border-t p-4">
            {/* Pré-visualização */}
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

            {/* Formulário */}
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
