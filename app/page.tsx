"use client";

import { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import entregas from "@/lib/entregas.json";
import motoBoys from "@/lib/motoboys.json";
import Image from "next/image";
import "./SendButton.css";
import { IoDocumentAttachOutline } from "react-icons/io5";

//#regions TIPOS
type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: string;
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

//#endregions

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deliveries, setDeliveries] = useState<Delivery[]>([]); // Lista de entregas
  const [deliveryData, setDeliveryData] = useState<Partial<Delivery>>({});
  //const [imagemSelecionada, setImagemSelecionada] = useState<File | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
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

    // Verifica se há imagens carregadas
    if (uploadedImages.length > 0) {
      const combinedContent = [
        ...uploadedImages.map((image) => `![image](${image})`), // Formata as imagens
        input.trim() ? input : "", // Adiciona o texto, se houver
      ]
        .filter(Boolean) // Remove valores vazios
        .join("\n"); // Junta tudo com quebras de linha

      const imageMessage: UIMessage = {
        id: `image-message-${Date.now()}`,
        role: "user",
        content: combinedContent, // Inclui imagens e texto
        timestamp: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? { ...conv, messages: [...conv.messages, imageMessage] }
            : conv
        )
      );

      setUploadedImages([]); // Limpa as imagens carregadas
      setInput(""); // Limpa o campo de texto
    } else {
      // Verifica se o campo de entrada está vazio
      if (!input.trim()) {
        console.warn("Mensagem vazia não pode ser enviada.");
        setIsLoading(false);
        return;
      }

      const userMessage: UIMessage = {
        id: `user-message-${Date.now()}`,
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
        sendResponse(response);
      } catch (error) {
        console.error("Erro ao processar a mensagem:", error);
        sendResponse("Desculpe, ocorreu um erro inesperado.");
      }

      setInput(""); // Limpa o campo de texto
    }

    setTimeout(() => {
      setIsSubmitClicked(false);
    }, 500);
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

  // Função para enviar as imagens armazenadas no estado
  /*const sendImagesToChat = () => {
    if (!currentConversationId || uploadedImages.length === 0) return;

    const imageMessage: UIMessage = {
      id: `image-message-${Date.now()}`,
      role: "user",
      content: uploadedImages.join("|"), // Use "|" como delimitador para evitar conflitos
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, imageMessage] }
          : conv
      )
    );

    setUploadedImages([]); // Limpa o estado de imagens após o envio
  };*/
  //#endregion
  //#endregion

  //#region Funções de Busca
  const fetchDeliveryDetails = (deliveryId: number) => {
    return entregas.find((item) => item.id === deliveryId);
  };

  const fecthDriverDetails = (driverId: number) => {
    return motoBoys.find((item) => item.id === driverId);
  };
  //#endregion

  //#region Funções do Gemini
  const sendToGemini = async (payload: { text?: string; image?: string }) => {
    try {
      const model = "gemini-2.0-flash"; // Certifique-se de que o modelo suporta multimodalidade

      const contents = [
        {
          role: "user",
          parts: [
            ...(payload.image
              ? [
                  {
                    inlineData: {
                      mimeType: "image/png", // Ajuste o tipo MIME conforme necessário
                      data: payload.image.split(",")[1], // Remove o prefixo "data:image/...;base64,"
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

      sendResponse(partialMessage); // Envia a resposta do Gemini para o chat
      return partialMessage;
    } catch (error) {
      console.error("Erro ao enviar mensagem ao Gemini:", error);
      const errorMessage =
        "Desculpe, ocorreu um erro ao interagir com a IA. Tente novamente.";
      sendResponse(errorMessage); // Envia a mensagem de erro para o chat
      return errorMessage;
    }
  };
  //#endregion

  //#region Funções de Finalização de Entrega
  const finalizeDelivery = () => {
    if (
      !deliveryData.nomeResponsavel ||
      !deliveryData.enderecoDestino ||
      !deliveryData.enderecoDestino.rua ||
      !deliveryData.enderecoDestino.numero ||
      !deliveryData.enderecoDestino.bairro ||
      !deliveryData.enderecoDestino.cidade ||
      !deliveryData.enderecoDestino.cep
    ) {
      sendResponse(
        "Por favor, forneça todas as informações necessárias para registrar a entrega."
      );
      return;
    }

    const newDelivery: Delivery = {
      nomeResponsavel: deliveryData.nomeResponsavel,
      enderecoDestino: deliveryData.enderecoDestino,
      enderecoOrigem: deliveryData.enderecoOrigem || {
        rua: "Rua cadastrada no sistema",
        numero: "123",
        bairro: "Bairro cadastrado",
        cidade: "Cidade cadastrada",
        cep: "00000-000",
      },
    };

    // Adiciona a nova entrega ao array de entregas
    setDeliveries((prev) => {
      const updatedDeliveries = [...prev, newDelivery];
      console.log("Lista de entregas atualizada:", updatedDeliveries); // Exibe o array no console
      return updatedDeliveries;
    });

    sendResponse("Entrega registrada com sucesso!");
    setDeliveryData({}); // Limpa os dados temporários
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
      return (
        structuredResponse.message || "Por favor, informe o ID da entrega."
      );
    }

    const deliveryDetails = fetchDeliveryDetails(deliveryId);
    if (deliveryDetails) {
      const prompt = `
      O cliente forneceu o ID da entrega: ${deliveryId}.
      Aqui estão os detalhes da entrega:
      - Situação: ${deliveryDetails.situacao}
      - Nome do Entregador: ${deliveryDetails.nomeEntregador}
      - Veículo: ${deliveryDetails.veiculo}
      - Valor: R$ ${deliveryDetails.valor.toFixed(2)}
      - Estimativa de Entrega: faça um cálculo euclidiano para calcular
        a distância entre o ponto de origem e o ponto de entrega e forneça
        a estimativa de entrega em minutos tendo base que a localização do
        motoboy é ${deliveryDetails.coordenadas} e localização do cliente
        é sempre "latitude": -23.55052, "longitude": -46.633308 e apenas diga
        qual é a estimativa do tempo sem dar detalhes de como fez.

      Por favor, gere uma resposta de forma amigável e clara e bonita para o cliente.`;
      return await sendToGemini(prompt);
    } else {
      return "Nenhuma entrega encontrada com o ID fornecido.";
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
        structuredResponse.message || "Por favor, informe o ID do entregador."
      );
    }

    const driverDetails = fecthDriverDetails(driverId);

    if (driverDetails) {
      const prompt = `O cliente forneceu o ID do entregador: ${driverId}.
                      Aqui estão os detalhes do entregador: 
                      - Nome: ${driverDetails.nome} 
                      - Telefone: ${driverDetails.telefone} 
                      - Entregas feitas: ${driverDetails.entregasRealizadas}
                      - Avaliação: ${driverDetails.avaliacao} 
                      Por favor, formate essa resposta de forma amigável e clara para o cliente.`;
      return await sendToGemini(prompt);
    } else {
      return "Nenhum entregador encontrado com o ID fornecido.";
    }
  };
  //#endregion
  //#endregion

  //#region FUNÇÕES DE INSERÇÃO DE ENTREGA
  //#region Insert Delivery
  const handleInsertDelivery = async (userInput: string): Promise<string> => {
    console.log("Estado atual de deliveryData:", deliveryData); // Log para depuração

    if (!deliveryData.nomeResponsavel) {
      setDeliveryData((prev) => ({ ...prev, nomeResponsavel: userInput }));
      return "Por favor, informe o endereço de destino (rua, número, bairro, cidade, CEP).";
    }

    if (!deliveryData.enderecoDestino) {
      const [rua, numero, bairro, cidade, cep] = userInput.split(",");
      if (!rua || !numero || !bairro || !cidade || !cep) {
        return "Por favor, forneça todos os campos do endereço de destino separados por vírgula.";
      }
      setDeliveryData((prev) => ({
        ...prev,
        enderecoDestino: {
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          cep: cep.trim(),
        },
      }));
      return "Agora, informe o endereço de origem (rua, número, bairro, cidade, CEP) ou digite 'usar endereço padrão'.";
    }

    if (!deliveryData.enderecoOrigem) {
      if (userInput.toLowerCase() === "usar endereço padrão") {
        finalizeDelivery();
        return "Entrega registrada com sucesso!";
      }

      const [rua, numero, bairro, cidade, cep] = userInput.split(",");
      if (!rua || !numero || !bairro || !cidade || !cep) {
        return "Por favor, forneça todos os campos do endereço de origem separados por vírgula.";
      }
      setDeliveryData((prev) => ({
        ...prev,
        enderecoOrigem: {
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          cep: cep.trim(),
        },
      }));
      finalizeDelivery();
      return "Entrega registrada com sucesso!";
    }
    console.log("deliveryData antes de processar:", deliveryData);
    return "Desculpe, não consegui entender sua solicitação.";
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
3 - Always respond in the same language that the user used.
4 - Whenever the system passes information to you, it will be within 'data'.
5 - Never share someone's location; instead, use Euclidean distance to calculate the distance.
    
   ${
     /*#Image Processing:
1 - If the user sends an image, the 'data' field will contain a base64-encoded string of the image and its mimeType.
2 - The image will be handled by a separate function ('sendToGemini' with image payload). This 'processUserInput' function should NOT try to re-process the image if it's already being handled.
3 - If 'processUserInput' receives a text input that seems to refer to an image already sent, it should respond generally or ask for clarification, as the image processing is handled elsewhere.*/ ""
   }

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
    1 - Whenever the user initiates a delivery, request the following information: responsible person's name, destination address (street, number, neighborhood, city, ZIP code), and origin address (same attributes as the destination). If these details are not provided, use the default addresses registered in the system.
    2 - Whenever you need to insert a delivery, use the event code: insert_delivery.
    
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
        // Se não for JSON, pode ser uma resposta direta do modelo sem a estrutura esperada.
        // Ou pode ser um erro na instrução do sistema.
        // Por enquanto, vamos retornar a mensagem parcial como está.
        // Em um cenário ideal, você pode querer um fallback mais robusto aqui.
        return (
          partialMessage ||
          "Desculpe, não consegui processar sua solicitação neste momento."
        );
      }

      const structuredResponse = JSON.parse(partialMessage);
      console.log("Resposta estruturada do modelo:", structuredResponse);

      switch (structuredResponse.event?.code) {
        // Adicionado '?' para segurança
        case "search_delivery":
          return await handleSearchDelivery(structuredResponse);

        case "search_driver":
          return await handleSearchDriver(structuredResponse);

        case "insert_delivery":
          if (!deliveryData.nomeResponsavel) {
            // A lógica de pedir o nome do responsável já está no systemInstruction.
            // O Gemini deve retornar uma mensagem pedindo o nome.
            // Se o código é 'insert_delivery' e não temos nome, o Gemini deve ter enviado a mensagem.
            return (
              structuredResponse.message ||
              "Por favor, informe o nome do responsável pela entrega."
            );
          }
          return await handleInsertDelivery(userInput); // userInput aqui pode ser o endereço, etc.

        case "general_response":
        default:
          return (
            structuredResponse.message ||
            "Desculpe, não consegui entender sua solicitação."
          );
      }
    } catch (error) {
      console.error("Erro ao processar a resposta do modelo:", error);
      return "Desculpe, ocorreu um erro ao processar a resposta.";
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
      id: `bot-message-${Date.now()}`,
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
                    {m.role === "user" && m.content.includes("data:image/")
                      ? m.content.split("\n").map((part, i) => {
                          // Verifica se o conteúdo é uma imagem no formato Markdown
                          const imageMatch = part.match(
                            /!\[image\]\((data:image\/[a-zA-Z]+;base64,[^\)]+)\)/
                          );
                          if (imageMatch) {
                            return (
                              <Image
                                key={i}
                                src={imageMatch[1]} // Extrai o base64 da imagem
                                alt={`Imagem enviada pelo usuário ${i + 1}`}
                                width={200}
                                height={200}
                                className="imgUser rounded-md mb-4 mr-2"
                                unoptimized // Necessário para imagens base64
                              />
                            );
                          }

                          // Caso contrário, renderiza como texto
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
                  </div>
                </div>
              ))
            )}
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
                multiple // Permite selecionar múltiplas imagens
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
