/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { GoogleGenAI, Type } from "@google/genai";
import entregas from "@/lib/entregas.json";
import motoBoys from "@/lib/motoboys.json";
import users from "@/lib/users.json";
import Image from "next/image";
import "./SendButton.css";
import { IoDocumentAttachOutline } from "react-icons/io5";
import { FiSearch } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

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
  title: string;
  messages: UIMessage[];
  participantes?: string[];
  participantesInfo?: {
    bot?: {
      avatarUrl?: string;
      displayName?: string;
    };
    user?: {
      avatarUrl?: string;
      displayName?: string;
    };
  };
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

async function generateTitleWithGemini(
  userMessage: string,
  aiInstance: GoogleGenAI
): Promise<string> {
  const prompt = `
    Gere um título curto (máximo 5 palavras) que resuma o assunto da seguinte mensagem
    do usuário para nomear uma conversa de chat. Não use pontuação no final.

Mensagem: "${userMessage}"
Título:
  `.trim();

  try {
    const response = await aiInstance.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const title =
      response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return title.replace(/^["']|["']$/g, "").replace(/[.?!]$/, "");
  } catch {
    return userMessage.slice(0, 30);
  }
}

function extrairEndereco(enderecoCompleto: string) {
  const regex =
    /^(.*?),\s*(\d+)\s*-\s*(.*?),\s*(.*?)\s*-\s*([A-Z]{2}),\s*([\d-]+)$/;
  const match = enderecoCompleto.match(regex);

  if (match) {
    const [, rua, numero, bairro, cidade, uf, cep] = match;
    return { rua, numero, bairro, cidade, uf, cep: cep.replace(/-/g, "") };
  }
  return null;
}

// Salvar conversas
async function salvarConversasNoFirebase(
  userId: string,
  conversations: Conversation[]
) {
  await setDoc(doc(collection(db, "conversations"), userId), { conversations });
}

// Salvar conversa individualmente
// Salva conversa (sem messages) e salva cada mensagem como doc na subcoleção
async function salvarConversaNoFirebase(
  userId: string,
  conversation: Conversation
) {
  const { messages, ...convData } = conversation;

  // Extrai o número da conversa do ID (exemplo: "Conversa 3-1699999999999")
  let numeroConversa = "1";
  const match = conversation.id.match(/Conversa\s*(\d+)/i);
  if (match && match[1]) {
    numeroConversa = match[1];
  }

  const participantesInfo = {
    bot: {
      avatarUrl: "/roboIcon.png",
      displayName: "BOT",
    },
    user: {
      avatarUrl: `https://i.pravatar.cc/150?u=user${numeroConversa}`,
      displayName: "demo",
    },
  };

  await setDoc(doc(collection(db, "conversations"), conversation.id), {
    ...convData,
    userId,
    participantes: ["bot", "user"],
    participantesInfo,
  });

  // Salva mensagens na subcoleção
  const batch = writeBatch(db);
  const messagesRef = collection(
    db,
    "conversations",
    conversation.id,
    "messages"
  );
  const oldMessages = await getDocs(messagesRef);
  oldMessages.forEach((msg) => batch.delete(msg.ref));
  messages.forEach((msg) => {
    batch.set(doc(messagesRef, msg.id), msg);
  });
  await batch.commit();
}

// Carregar todas as conversas do usuário
async function carregarConversasDoFirebase(
  userId: string
): Promise<Conversation[]> {
  const q = query(
    collection(db, "conversations"),
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);

  const conversations: Conversation[] = [];
  for (const docSnap of querySnapshot.docs) {
    const convData = docSnap.data();
    // Busca as mensagens da subcoleção
    const messagesSnap = await getDocs(
      collection(db, "conversations", docSnap.id, "messages")
    );
    const messages = messagesSnap.docs
      .map((msg) => msg.data() as UIMessage)
      .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
    conversations.push({
      ...(convData as Omit<Conversation, "messages">),
      id: docSnap.id,
      messages,
    });
  }
  return conversations;
}

// Carregar entregas
async function carregarEntregasDoFirebase(
  userId: string
): Promise<any[] | null> {
  const docSnap = await getDoc(doc(collection(db, "deliveries"), userId));
  if (docSnap.exists()) {
    return docSnap.data().deliveries as any[];
  }
  return null;
}

export default function Page() {
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
  const [showDeliveriesSidebar, setShowDeliveriesSidebar] = useState(false);
  const [openDelivery, setOpenDelivery] = useState<number | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [themeLoaded, setThemeLoaded] = useState<boolean>(false);
  const [, setLogoClicked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deliveriesLoaded, setDeliveriesLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const placeholderInterval = useRef<NodeJS.Timeout | null>(null);
  //#endregion

  const ai = new GoogleGenAI({
    apiKey: "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ",
  });

  //#region Funções de Conversa
  const createNewConversation = () => {
    // Extrai o número da próxima conversa
    const numeroConversa = conversationCounter;

    const newConv: Conversation = {
      id: `Conversa ${numeroConversa}-${Date.now()}`,
      title: "Nova conversa",
      messages: [],
      participantes: ["bot", "user"],
      participantesInfo: {
        bot: {
          avatarUrl: "/roboIcon.png",
          displayName: "BOT",
        },
        user: {
          avatarUrl: `https://i.pravatar.cc/150?u=user${numeroConversa}`,
          displayName: "demo",
        },
      },
    };
    setConversations((prev) => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    setConversationCounter((c) => c + 1);
  };

  // Salvar:
  useEffect(() => {
    localStorage.setItem("currentConversationId", currentConversationId ?? "");
  }, [currentConversationId]);

  // Carregar:
  useEffect(() => {
    const saved = localStorage.getItem("conversations");
    const savedId = localStorage.getItem("currentConversationId");
    if (saved) {
      setConversations(JSON.parse(saved));
      if (savedId) setCurrentConversationId(savedId);
      else {
        const firstConv = JSON.parse(saved)[0];
        if (firstConv) setCurrentConversationId(firstConv.id);
      }
    } else {
      createNewConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const participantesInfo = currentConversation?.participantesInfo || {};

  //#endregion

  //#region Funções de Input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) {
      setIsLoading(false);
      setIsSubmitClicked(false);
      return; // Não envia mensagem vazia
    }
    if (!currentConversationId || isLoading) return;

    setIsLoading(true); // Ativa o loading logo no início

    // Troca o tema se o comando for /theme
    if (input.trim().toLowerCase() === "/theme") {
      setDarkMode((prev) => !prev);
      setInput("");
      setIsSubmitClicked(false);
      setIsLoading(false);
      return;
    }

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

    // Gera título com Gemini se for a primeira mensagem
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (conv && conv.messages.length === 0) {
      try {
        const geminiTitle = await generateTitleWithGemini(input, ai);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId ? { ...c, title: geminiTitle } : c
          )
        );
      } catch {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, title: input.slice(0, 30) }
              : c
          )
        );
      }
    }

    // Fluxo conversacional de entrega
    if (deliveryStep) {
      const response = await handleInsertDelivery(input);
      sendResponse(response);
      setInput("");
      setIsSubmitClicked(false);
      return;
    }

    // LISTA DE ENTREGAS
    if (input.trim().toLowerCase() === "/listar-entregas") {
      setShowDeliveriesSidebar(true);
      sendResponse(
        deliveries.length === 0
          ? "Nenhuma entrega registrada."
          : "Veja a lista de entregas na aba à direita!"
      );
      setInput("");
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
      return;
    }

    if (!input.trim()) {
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
    const found = (entregas as Record<string, any>)[String(deliveryId)];
    if (found) return found;
    return deliveries.find((d: any) => d.id === deliveryId);
  };

  const fecthDriverDetails = (driverId: number) => {
    return motoBoys.find((item) => item.id === driverId);
  };

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
        destino?.zipCode ?? "N/A"
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

  //#region FUNÇÕES DE INSERÇÃO DE ENTREGA
  //#region Insert Delivery
  const handleInsertDelivery = async (userInput: string): Promise<string> => {
    if (deliveryStep === "destino") {
      const endereco = extrairEndereco(userInput);
      if (!endereco) {
        return "Por favor, informe o endereço no formato: Rua, número - Bairro, Cidade - UF, CEP";
      }
      setPendingDelivery({
        enderecoDestino: endereco,
      });
      setDeliveryStep("responsavel");
      return "Qual o nome do responsável pela entrega?";
    }
    if (deliveryStep === "responsavel" && pendingDelivery?.enderecoDestino) {
      const nomeResponsavel = userInput.trim();
      if (!nomeResponsavel) {
        return "Por favor, informe o nome do responsável.";
      }

      const user = users.find(
        (u: any) =>
          u.name?.toLowerCase().trim() === nomeResponsavel.toLowerCase().trim()
      );
      if (!user || !user.endereco) {
        return "Responsável não encontrado ou sem endereço cadastrado no sistema.";
      }

      const newId = generateRandomId();
      const randomEntrega = Object.values(entregas)[
        Math.floor(Math.random() * Object.values(entregas).length)
      ] as any;

      const addresses = [
        {
          street: user.endereco.rua,
          number: user.endereco.numero,
          neighborhood: user.endereco.bairro,
          city: user.endereco.cidade,
          state: "",
          zipCode: user.endereco.cep,
          position: 0,
          responsible: nomeResponsavel,
          status: 0,
        },
        {
          street: pendingDelivery.enderecoDestino.rua,
          number: pendingDelivery.enderecoDestino.numero,
          neighborhood: pendingDelivery.enderecoDestino.bairro,
          city: pendingDelivery.enderecoDestino.cidade,
          state: "",
          zipCode: pendingDelivery.enderecoDestino.cep,
          position: 1,
          responsible: nomeResponsavel,
          status: 0,
        },
      ];

      const statusOptions = [
        { description: "Pendente", type: 0 },
        { description: "Entregue", type: 1 },
        { description: "Cancelado", type: 2 },
      ];
      const randomStatus =
        statusOptions[Math.floor(Math.random() * statusOptions.length)];

      const newDelivery = {
        id: newId,
        title: pendingDelivery.enderecoDestino.rua, // <-- título = rua do destino
        addresses,
        deliveryman: randomEntrega?.deliveryman ?? null,
        price: randomEntrega?.price ?? null,
        situation: randomStatus,
      };

      setDeliveries((prev) => {
        const novas = [...prev, newDelivery];
        // salvarEntregasNoFirebase(userId, novas); // Salva imediatamente no Firebase
        return novas;
      });
      setDeliveryStep(null);
      setPendingDelivery(null);
      return "Entrega cadastrada com sucesso!";
    }
    return "Não entendi sua solicitação.";
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
2 - Whenever a user asks about a delivery **and fornece o ID da entrega**, use o código de evento: search_delivery e inclua o ID fornecido no campo 'correlation'.
3 - Sempre que precisar consultar informações sobre uma entrega, use o código de evento: search_delivery.

# Entregador:
1 - Sempre que um usuário perguntar sobre um entregador, solicite o ID do entregador.
2 - Sempre que precisar consultar informações sobre um entregador, use o código de evento: search_driver.

# Inserir Entrega:
1 - Quando o usuário pedir para adicionar ou inserir uma entrega, primeiro pergunte o endereço de destino no formato: rua, número, bairro, cidade, CEP.
2 - Após receber o endereço, pergunte o nome do responsável pela entrega.
3 - Depois de receber o endereço de destino, pergunte o endereço de origem (mesmo formato do destino) ou permita que o usuário digite "usar endereço padrão".
4 - Sempre valide se o usuário forneceu todos os campos obrigatórios antes de confirmar a entrega.
5 - Somente confirme o registro da entrega quando todas as informações estiverem completas e o usuário confirmar.
6 - Se o usuário fornecer todas as informações em uma única mensagem, extraia os dados e confirme o registro.

# Resposta Geral:
1 - Se a mensagem do usuário não estiver relacionada a entregas ou entregadores, responda normalmente com base no contexto da mensagem.
2 - Use o código de evento: general_response para tais casos.
3 - Garanta que a resposta seja amigável, clara e concisa.
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
          setDeliveryStep("destino");
          setPendingDelivery({});
          sendResponse(
            "Qual o endereço de destino da entrega? (Rua, número, bairro, cidade, CEP)"
          );
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
        setIsLoading(false);
      }
    }, 5);
  };
  //#endregion

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation?.messages]);

  useEffect(() => {
    if (showDeliveriesSidebar) {
      setTimeout(() => setSidebarVisible(true), 10);
    } else {
      setSidebarVisible(false);
    }
  }, [showDeliveriesSidebar]);

  const animatePlaceholder = (text: string) => {
    setSearchPlaceholder("");
    let i = 0;
    if (placeholderInterval.current) clearInterval(placeholderInterval.current);
    placeholderInterval.current = setInterval(() => {
      setSearchPlaceholder((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        if (placeholderInterval.current)
          clearInterval(placeholderInterval.current);
      }
    }, 60);
  };

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogoClick = () => {
    setLogoClicked(true);
    setTimeout(() => setLogoClicked(false), 1200);
  };

  function handleCloseSidebar() {
    setClosing(true);
    setTimeout(() => {
      setShowDeliveriesSidebar(false);
      setClosing(false);
    }, 400);
  }

  const router = useRouter();
  const userId = "demo";

  useEffect(() => {
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    async function loadTheme() {
      if (userId) {
        const userDoc = await getDoc(doc(collection(db, "users"), userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (typeof data.darkMode === "boolean") setDarkMode(data.darkMode);
        }
      }
      setThemeLoaded(true); // <- só libera o render depois de buscar o tema
    }
    loadTheme();

    if (userId) {
      carregarConversasDoFirebase(userId).then((convs) => {
        if (convs) setConversations(convs);
        else createNewConversation();
        setConversationsLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId && conversationsLoaded) {
      salvarConversasNoFirebase(userId, conversations);
    }
  }, [conversations, userId, conversationsLoaded]);

  useEffect(() => {
    if (userId && conversationsLoaded && currentConversationId) {
      const conv = conversations.find((c) => c.id === currentConversationId);
      if (conv) {
        salvarConversaNoFirebase(userId, conv);
      }
    }
  }, [conversations, userId, conversationsLoaded, currentConversationId]);

  useEffect(() => {
    if (userId) {
      setDoc(
        doc(collection(db, "users"), userId),
        { darkMode },
        { merge: true }
      );
    }
  }, [darkMode, userId]);

  useEffect(() => {
    async function loadDeliveries() {
      const entregasSalvas = await carregarEntregasDoFirebase(userId);
      if (entregasSalvas) setDeliveries(entregasSalvas);
      setDeliveriesLoaded(true); // <-- só depois de carregar
    }
    if (userId) {
      loadDeliveries();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && deliveriesLoaded) {
      //salvarEntregasNoFirebase(userId, deliveries);
    }
  }, [deliveries, userId, deliveriesLoaded]);

  if (!themeLoaded) {
    return <div />; // Ou um loader, se preferir
  }

  return (
    <div
      className={`flex min-h-screen w-full ${
        darkMode ? "bg-[#333]" : "bg-gray-100"
      }`}
    >
      {/* Botão tira lateral */}
      <button
        onClick={() => router.push("/heatMap")}
        className={`
          fixed top-1/2 right-0 z-50
          flex items-center
          bg-green-600 text-white
          rounded-l-full
          shadow-lg
          transition-all duration-300
          pr-2 pl-4 py-2
          -translate-y-1/2
          group
          hover:bg-green-700 hover:scale-105
          w-12 hover:w-40
          cursor-pointer
          overflow-hidden
          border-2 border-green-700
          focus:outline-none focus:ring-2 focus:ring-green-400
        `}
        title="Ver HeatMap"
      >
        <span className="text-2xl">🗺️</span>
        <span
          className={`
            ml-3 text-base font-bold opacity-0
            group-hover:opacity-100
            transition-opacity duration-300
            whitespace-nowrap
            pointer-events-none
          `}
          style={{ width: "0", display: "inline-block" }}
        >
          HeatMap
        </span>
      </button>

      {/* Botão de troca de perfil */}
      <button
        onClick={() => router.push("/profile")}
        className={`
          fixed top-[60%] right-0 z-50
          flex items-center
          bg-blue-600 text-white
          rounded-l-full
          shadow-lg
          transition-all duration-300
          pr-2 pl-4 py-2
          -translate-y-1/2
          group
          hover:bg-blue-700 hover:scale-105
          w-12 hover:w-40
          cursor-pointer
          overflow-hidden
          border-2 border-blue-700
          focus:outline-none focus:ring-2 focus:ring-blue-400
        `}
        title="Trocar Perfil"
      >
        <span className="text-2xl">👤</span>
        <span
          className={`
            ml-3 text-base font-bold opacity-0
            group-hover:opacity-100
            transition-opacity duration-300
            whitespace-nowrap
            pointer-events-none
          `}
          style={{ width: "0", display: "inline-block" }}
        >
          Trocar Perfil
        </span>
      </button>

      {/* Sidebar de conversas */}
      <div
        className={`
          sideBar
          w-4/5 max-w-xs
          fixed sm:static
          top-0 left-0 h-full z-50
          shadow-md p-4
          overflow-y-hidden
          transition-transform duration-300 
          -translate-x-full
          sm:translate-x-0 sm:w-64 sm:h-auto sm:shadow-md
          ${sidebarOpen ? "translate-x-0" : ""}
          relative
          ${sidebarOpen ? "w-full max-w-full" : ""}
        `}
        style={{
          boxShadow: darkMode
            ? "0 2px 8px 0 rgba(0,0,0,0.7)"
            : "16px 6px 11px -11px rgba(0,0,0,0.5)",
          WebkitBoxShadow: darkMode
            ? "0 2px 8px 0 rgba(0,0,0,0.7)"
            : "16px 6px 11px -11px rgba(0,0,0,0.5)",
          MozBoxShadow: darkMode
            ? "0 2px 8px 0 rgba(0,0,0,0.7)"
            : "16px 6px 11px -11px rgba(0,0,0,0.5)",
        }}
      >
        <div className="mb-4 relative flex items-center justify-center">
          {/* Logo centralizado */}
          <Image
            src={darkMode ? "/i9White.png" : "/fb-og.png"}
            alt="Logo"
            width={150}
            height={150}
            className="mx-auto transition-transform duration-300 hover:scale-110 cursor-pointer"
            onClick={handleLogoClick}
          />
        </div>

        <h2 className="text-lg font-bold mb-4 text-center">Conversas</h2>

        <button
          onClick={createNewConversation}
          className={`w-full px-4 py-2 rounded-md mb-4
            transition-colors duration-500
            ${
              darkMode
                ? "bg-green-900 text-white hover:bg-green-800"
                : "bg-green-500 text-white hover:bg-green-700"
            }
          `}
        >
          Nova Conversa
        </button>

        <div className="relative mb-4">
          <span
            className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300
              ${searchFocused ? "text-[#16a34a]" : "text-gray-400"}`}
          >
            <FiSearch size={18} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              animatePlaceholder("BBuscar conversa");
            }}
            onBlur={() => {
              setSearchFocused(false);
              setSearchPlaceholder("");
              if (placeholderInterval.current)
                clearInterval(placeholderInterval.current);
            }}
            placeholder={searchFocused ? searchPlaceholder : ""}
            className={`
              w-full
              pl-10 pr-4
              border rounded-md
              focus:outline-none
              transition-all duration-500
              ${
                darkMode
                  ? "bg-[#222] text-gray-100 placeholder-gray-400"
                  : "bg-white text-gray-900 placeholder-gray-400"
              }
              ${searchFocused ? "h-12 border-[#16a34a]" : "h-8 border-gray-300"}
            `}
            style={{
              transitionProperty: "height, border-color",
              minHeight: "2rem",
              maxHeight: "3rem",
            }}
          />
        </div>

        <div
          className="space-y-2 rounded-lg my-2 custom-scrollbar"
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "12px",
          }}
        >
          {conversations
            .filter((conv) =>
              conv.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((conv) => (
              <button
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`slideConversation block w-full px-4 py-2 rounded-md text-center
                  transition-all duration-500 transition-colors
                  ${
                    conv.id === currentConversationId
                      ? darkMode
                        ? "bg-green-900 text-white scale-110"
                        : "bg-green-500 text-white scale-110"
                      : darkMode
                      ? "bg-gray-800 text-gray-100 hover:scale-105 hover:text-green-400"
                      : "bg-gray-200 text-gray-800 hover:scale-105 hover:text-green-600"
                  }
                `}
              >
                <b>{conv.title}</b>
              </button>
            ))}
        </div>

        {/* Botão de alternar tema fixo no rodapé - só no desktop */}
        <div className="absolute bottom-4 left-0 w-full justify-center hidden sm:flex">
          <button
            onClick={() => setDarkMode((prev) => !prev)}
            className={`
              w-14 h-7 flex items-center rounded-full p-1
              transition-colors duration-500
              ${darkMode ? "bg-[#14532d]" : "bg-gray-300"}
            `}
            aria-label="Alternar modo escuro"
          >
            <div
              className={`
                w-6 h-6 rounded-full bg-white shadow-md transform
                transition-transform duration-300 flex items-center justify-center
                ${darkMode ? "translate-x-7" : "translate-x-0"}
              `}
            >
              {darkMode ? (
                <span
                  role="img"
                  aria-label="Lua"
                  className="text-yellow-400 text-lg transition-colors duration-500"
                >
                  🌙
                </span>
              ) : (
                <span
                  role="img"
                  aria-label="Sol"
                  className="text-yellow-500 text-lg transition-colors duration-500"
                >
                  ☀️
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Container central para chat + entregas */}
      <div className="flex flex-1 min-h-0 min-w-0 items-center justify-center gap-x-4 overflow-hidden">
        {/* Chat principal */}
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] sm:h-[90vh] sm:max-w-2xl mx-auto">
          <div
            className={`
              flex flex-col w-full h-full
              sm:rounded-lg sm:shadow-md
              overflow-hidden
              ${
                darkMode ? "bg-[#222] text-white" : "bg-[#f9f9f9] text-gray-800"
              }
            `}
            style={{
              boxShadow: darkMode
                ? "0px 10px 26px 14px rgba(0,0,0,0.7)"
                : "0px 10px 26px 14px rgba(176,176,176,0.75)",
            }}
          >
            {/* Header */}
            <div
              className={`${
                darkMode ? "bg-green-900" : "bg-green-600"
              } text-white p-4 flex items-center justify-center relative transition-colors duration-500 shrink-0`}
            >
              {/* Botão hambúrguer só no mobile */}
              <button
                className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 bg-transparent p-1"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label="Abrir menu"
              >
                <svg width="28" height="28" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 8h20M4 16h20"
                  />
                </svg>
              </button>
              {/* Título centralizado */}
              <h1 className="text-xl font-bold w-full text-center">
                Chatbot I9
              </h1>
              {/* Logo à direita (opcional) */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Image
                  src="/logo_i9delivery.png"
                  alt="chatbot"
                  width={40}
                  height={40}
                  className="slideLogo"
                />
              </div>
            </div>
            {/* Mensagens + Input */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Mensagens */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-chat-placeholder">
                {currentConversation &&
                currentConversation.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xl font-bold text-green-700 px-6 py-4 ">
                      Envie uma mensagem para começar a conversa
                    </span>
                  </div>
                ) : (
                  currentConversation?.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div className="relative max-w-[80%] sm:max-w-[75%]">
                        <Image
                          src={
                            m.role === "user"
                              ? participantesInfo.user?.avatarUrl || "/default-user.png"
                              : "/roboIcon.png"
                          }
                          alt={m.role === "user" ? "User Avatar" : "Bot Avatar"}
                          width={32}
                          height={32}
                          className={`
                            rounded-full
                            absolute
                            z-20
                            shadow
                            ${
                              m.role === "user"
                                ? `${
                                    darkMode
                                      ? "ring-2 ring-[#222] bg-[#222]"
                                      : "ring-2 ring-[#f9f9f9] bg-[#f9f9f9]"
                                  } right-3 -top-4`
                                : `${
                                    darkMode
                                      ? "ring-2 ring-green-900 bg-green-900"
                                      : "ring-2 ring-green-600 bg-green-600"
                                  } left-3 -top-4`
                            }
                          `}
                          style={{
                            background:
                              m.role === "user"
                                ? darkMode
                                  ? "#222"
                                  : "#f9f9f9"
                                : darkMode
                                ? "#14532d"
                                : "#16a34a",
                          }}
                          unoptimized
                        />
                        {/* Balão da mensagem */}
                        <div
                          className={`
                            relative z-10 p-3 rounded-lg break-words
                            transition-colors duration-500
                            ${
                              m.role === "user"
                                ? darkMode
                                  ? "bg-green-900 text-white"
                                  : "bg-green-800 text-white"
                                : darkMode
                                ? "bg-gray-800 text-gray-100"
                                : "bg-gray-100 text-gray-600"
                            }
                          `}
                          style={{ paddingTop: "1.5rem" }} // espaço para o avatar
                        >
                          {/* Conteúdo da mensagem */}
                          {(typeof m.content === "string" ? m.content : "")
                            .split("\n")
                            .map((line, i) => (
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
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              {/* Input */}
              <div className="border-t p-4 shrink-0 bg-inherit">
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
                        ></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulário de entrada */}
                <form
                  onSubmit={handleFormSubmit}
                  className="flex w-full flex-wrap items-center gap-1 sm:gap-2"
                >
                  <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Digite sua mensagem..."
                    className={`flex-grow min-w-0 p-2 border rounded-md focus:outline-none transition-colors duration-600
                      ${
                        darkMode
                          ? "bg-[#222] text-gray-100 placeholder-gray-400 focus:border-green-900 focus:shadow-lg focus:shadow-green-900"
                          : "bg-gray-100 text-gray-900 placeholder-gray-400 focus:border-green-800 focus:shadow-lg focus:shadow-gray-400"
                      }
                      click:bg-white
                      focus:scale-101
                      transition-all duration-700
                    `}
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
                    className={`
                      px-2 sm:px-4 py-1 sm:py-2 border rounded-md cursor-pointer flex
                          ? "bg-[#222] text-green-600 hover:bg-green-900"
                          : "bg-gray-100 text-green-600 hover:bg-green-800"
                      }
                      ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    style={{ minWidth: "40px", justifyContent: "center" }}
                  >
                    <IoDocumentAttachOutline size={20} />
                  </label>
                  <button
                    type="submit"
                    className={`
                      border px-2 sm:px-4 py-1 sm:py-2 rounded-md cursor-pointer
                      transition-colors duration-500
                      ${
                        darkMode
                          ? "bg-[#222] text-green-600 hover:bg-green-900"
                          : "bg-gray-100 text-green-600 hover:bg-green-800"
                      }
                      ${
                        isLoading
                          ? darkMode
                            ? "bg-green-900 scale-105 text-white cursor-not-allowed"
                            : "bg-green-800 scale-105 text-white cursor-not-allowed"
                          : ""
                      }
                    `}
                    disabled={isLoading}
                    style={{ minWidth: "60px" }}
                  >
                    {isSubmitClicked && !isLoading ? (
                      "Enviado"
                    ) : isLoading ? (
                      <div className="wave-container-button">
                        <h1 className="wave-text-button">
                          <span>. </span>
                          <span>. </span>
                          <span>. </span>
                          <span>. </span>
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
        {/* Sidebar de entregas */}
        {showDeliveriesSidebar && (
          <div
            className={`
              sidebar-entregas-animada
              ${sidebarVisible ? "sidebar-entregas-animada--visible" : ""}
              ${closing ? "sidebar-entregas-animada--closing" : ""}
              fixed inset-y-0 right-0 z-40
              w-64 sm:w-80 md:w-96 lg:w-[28rem] xl:w-[32rem]
              sm:static sm:h-[90vh] sm:max-w-none sm:min-w-[20rem]
              flex flex-col rounded-xl shadow-xl
              ${darkMode ? "bg-[var(--sidebar)]" : "bg-white"}
              transition-transform duration-300 ease-in-out
            `}
          >
            {/* Header */}
            <div
              className={`
                p-4 font-bold text-lg flex items-center justify-between
                rounded-t-lg min-h-[3.5rem]
                ${
                  darkMode
                    ? "bg-[#14532d] text-white"
                    : "bg-[#178a46] text-white"
                }
              `}
            >
              <span>ENTREGAS</span>
              <button
                className="bg-transparent border-none text-white text-2xl cursor-pointer font-bold"
                onClick={handleCloseSidebar}
                title="Fechar"
              >
                ×
              </button>
            </div>
            {/* Conteúdo */}
            <div
              className={`
                flex-1 overflow-y-auto p-4
                ${
                  darkMode
                    ? "bg-[var(--sidebar)] text-[var(--sidebar-foreground)]"
                    : "bg-white text-gray-700"
                }
                overflow-x-hidden break-words
              `}
            >
              {deliveries.length === 0 ? (
                <p
                  className={`${
                    darkMode
                      ? "text-[var(--muted-foreground)]"
                      : "text-gray-500"
                  }`}
                >
                  Nenhuma entrega registrada.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex gap-2">
                    <select
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className={`border rounded px-2 py-1 transition-colors duration-300 ${
                        darkMode
                          ? "bg-[#232b2b] text-white border-[#333] placeholder-white"
                          : "bg-white text-black border-gray-300 placeholder-gray-400"
                      }`}
                    >
                      <option value="">Todos</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <ul className="entrega-lista shadow-lg rounded-xl bg-transparent p-0">
                    {deliveries
                      .filter(
                        (d) =>
                          !statusFilter ||
                          d.situation?.description === statusFilter
                      )
                      .map((d, i) => {
                        // const origem =
                        //   d.addresses?.find((a: any) => a.position === 0) || {};
                        // const destino =
                        //   d.addresses?.find((a: any) => a.position === 1) || {};

                        // const enderecoOrigem = encodeURIComponent(
                        //   `${origem.street ?? ""}, ${origem.number ?? ""}, ${
                        //     origem.neighborhood ?? ""
                        //   }, ${origem.city ?? ""}, ${origem.state ?? ""}, ${
                        //     origem.zipCode ?? ""
                        //   }`
                        // );
                        // const enderecoDestino = encodeURIComponent(
                        //   `${destino.street ?? ""}, ${destino.number ?? ""}, ${
                        //     destino.neighborhood ?? ""
                        //   }, ${destino.city ?? ""}, ${destino.state ?? ""}, ${
                        //     destino.zipCode ?? ""
                        //   }`
                        // );

                        return (
                          <li
                            key={d.id}
                            className={`
                              mb-2 rounded-lg
                              transition-all duration-300
                              ${
                                d.situation?.description === "Entregue"
                                  ? darkMode
                                    ? "bg-green-900 text-green-200"
                                    : "bg-green-300 text-green-900"
                                  : d.situation?.description === "Cancelado"
                                  ? darkMode
                                    ? "bg-red-900 text-red-200"
                                    : "bg-red-200 text-red-900"
                                  : darkMode
                                  ? "bg-[#14532d] text-white"
                                  : "bg-[#178a46] text-white"
                              }
                              hover:opacity-90 transition-opacity duration-200
                            `}
                            onClick={() =>
                              setOpenDelivery(openDelivery === i ? null : i)
                            }
                          >
                            <span className="flex-1 min-w-0 flex items-center">
                              <span className="entrega-icon mr-2 shrink-0">
                                📦
                              </span>
                              <span className="truncate">
                                {d.title || `Entrega ${i + 1} - `}
                              </span>
                            </span>
                            <span className="ml-2 shrink-0">
                              {openDelivery === i ? "▲" : "▼"}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlay para fechar sidebar no mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(4px)",
            zIndex: 9998,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Overlay para fechar sidebar de entregas no mobile */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm sm:hidden"
        onClick={() => setShowDeliveriesSidebar(false)}
      />
    </div>
  );
}
//#endregion