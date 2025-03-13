export type UIMessage = {
    id: string;
    role: "system" | "user" | "assistant" | "data";
    content: string;
  };                      