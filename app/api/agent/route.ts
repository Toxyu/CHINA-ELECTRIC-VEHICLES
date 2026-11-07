import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError } from "@/lib/http";

const SYSTEM_PROMPT = `You are the E.V CHINA GLOBAL sourcing assistant. You help international buyers understand how to source electric vehicles from China.
Your job:
- Ask for destination country, preferred make/model/body type, new or used condition, budget and timeline.
- Help users compare vehicle requirements such as battery capacity, driving range, charging connector/standard, left- or right-hand drive, model year and warranty.
- Explain the typical process: requirements, sourcing, written quotation, independent verification/inspection, payment under a written contract, export documentation, freight, customs and local registration.
- Be honest, calm, professional and commercially helpful. Ask one or two useful questions at a time.
Strict rules:
- Never invent stock, live prices, shipping rates, delivery dates, dealer authorisations, manufacturer partnerships, inspection results or guarantees.
- Do not claim that a vehicle is road-legal in a country without checking that country's current rules. Tell the user to confirm with the relevant regulator/customs authority.
- Explain that duties, taxes, homologation, port charges, insurance and registration vary by destination and are not included unless a written quote says so.
- Encourage customers to verify seller identity, VIN/chassis number, battery health, vehicle history, export eligibility, documents and payment beneficiary before sending money.
- Do not request passwords, card numbers, identity document images or other unnecessary sensitive information in chat.
- If the customer asks for a binding quote, confirm that a human team member must verify supplier, vehicle and logistics details.
- Do not present illustrative website models as confirmed inventory.
Keep replies concise and end with the next practical question or step.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Unable to read this message." }, { status: 400 });
  }

  if (new TextEncoder().encode(rawBody).byteLength > 16_000) {
    return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  }
  try {
    if (!(await checkRateLimit(`ai:${getClientAddress(req)}`, 20, 60 * 60 * 1000))) {
      return jsonError("AI usage limit reached. Try again later.", 429);
    }
  } catch (error) {
    console.error("AI rate limit persistence unavailable", error);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > 12
  ) {
    return NextResponse.json({ error: "Provide between 1 and 12 chat messages." }, { status: 400 });
  }

  const safeMessages: ChatMessage[] = [];
  for (const message of body.messages) {
    if (
      !isRecord(message) ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > 2_500
    ) {
      return NextResponse.json({ error: "Each message must have a valid role and non-empty content under 2,500 characters." }, { status: 400 });
    }

    safeMessages.push({ role: message.role, content: message.content });
  }

  const fallbackReply = "Hello! I can help you source BYD, Neta and Zeekr electric vehicles from China to Kenya and other markets. What is your budget in KES, destination country and preferred model?";
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("GROQ_API_KEY is not configured; using assistant fallback");
    return NextResponse.json({ reply: fallbackReply });
  }

  const latestQuestion = safeMessages.filter((message) => message.role === "user").at(-1)?.content || "";
  const searchTerms = [...new Set(latestQuestion.toLowerCase().match(/[a-z0-9-]{3,}/g) || [])].slice(0, 6);
  let inventory: { stockReference: string; make: string; model: string; year: number; bodyType: string; condition: string; currency: string; price: string; rangeKm: number | null; batteryKwh: string | null }[] = [];
  try {
    const matches = await prisma.vehicle.findMany({
      where: {
        availability: "AVAILABLE",
        verifiedAt: { not: null },
        publishedAt: { not: null },
        ...(searchTerms.length ? {
          OR: searchTerms.flatMap((term) => [
            { model: { contains: term, mode: "insensitive" as const } },
            { manufacturer: { name: { contains: term, mode: "insensitive" as const } } },
            { bodyType: { contains: term, mode: "insensitive" as const } },
          ]),
        } : {}),
      },
      include: { manufacturer: { select: { name: true } } },
      take: 5,
      orderBy: { publishedAt: "desc" },
    });
    inventory = matches.map((vehicle) => ({
      stockReference: vehicle.stockReference,
      make: vehicle.manufacturer.name,
      model: vehicle.model,
      year: vehicle.year,
      bodyType: vehicle.bodyType,
      condition: vehicle.condition,
      currency: vehicle.currency,
      price: vehicle.exportPrice.toString(),
      rangeKm: vehicle.rangeKm,
      batteryKwh: vehicle.batteryKwh?.toString() ?? null,
    }));
  } catch (error) {
    console.error("AI inventory context unavailable", error);
  }

  const inventoryContext = inventory.length
    ? `Verified currently available inventory (use only these records for stock, price, range or battery facts): ${JSON.stringify(inventory)}`
    : "There are no verified available inventory records matching this request. Do not recommend or price a listed vehicle; offer a human sourcing enquiry instead.";

  let upstream: Response;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n${inventoryContext}` }, ...safeMessages],
        temperature: 0.4,
        max_tokens: 450,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("AI provider request failed", error);
    return NextResponse.json({ reply: fallbackReply });
  }

  if (!upstream.ok) {
    console.error("AI provider returned", upstream.status);
    return NextResponse.json({ reply: fallbackReply });
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch (error) {
    console.error("AI provider returned invalid JSON", error);
    return NextResponse.json({ reply: fallbackReply });
  }

  if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) {
    console.error("AI provider response did not contain a choice");
    return NextResponse.json({ reply: fallbackReply });
  }

  const message = data.choices[0].message;
  if (!isRecord(message) || typeof message.content !== "string") {
    console.error("AI provider response did not contain message content");
    return NextResponse.json({ reply: fallbackReply });
  }

  return NextResponse.json({ reply: message.content });
}
