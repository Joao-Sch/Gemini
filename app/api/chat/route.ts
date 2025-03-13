import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 30;

export const Client = new GoogleGenerativeAI(
  "AIzaSyBvKRmd0mWD6fgZXXmBLXLgIaqV-fMBQmQ"
);

export async function POST(req: Request) {
  const { messages } = await req.json();

  const model = Client.getGenerativeModel({ model: "gemini-2.0-flash" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = messages.map((m: any) => m.content).join("\n");
  const result = await model.generateContent(message);
  const botMessage = result.response.text();
  console.log(botMessage);
  return new Response(JSON.stringify({ message: botMessage }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
