import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(12),
});

const systemPrompt = `You are the E.V CHINA GLOBAL sourcing assistant. Give concise, practical guidance about sourcing electric vehicles from China. Ask for destination country, budget, vehicle type, new or used status, and timeline when missing. Never claim a vehicle is available, compliant, inspected, or priced unless the user provides verified evidence. Explain that import eligibility, customs, taxes, freight, battery standards, and registration must be confirmed with qualified local professionals. Do not request passwords, payment details, API keys, or other sensitive information.`;

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "AI assistant is not configured in this deployment." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send between 1 and 12 valid messages." }, { status: 400 });
  }

  try {
    const result = await generateText({
      model: groq(process.env.GROQ_MODEL || "llama-3.3-70b-versatile"),
      system: systemPrompt,
      prompt: parsed.data.messages.map((message) => `${message.role}: ${message.content}`).join("\n\n"),
      maxOutputTokens: 500,
      temperature: 0.2,
    });

    return NextResponse.json({ reply: result.text });
  } catch (error) {
    console.error("[v0] AI assistant generation failed", error);
    return NextResponse.json({ error: "The AI assistant is temporarily unavailable. Please use the sourcing form instead." }, { status: 502 });
  }
}
