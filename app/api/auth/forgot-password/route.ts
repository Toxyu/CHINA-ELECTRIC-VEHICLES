import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password` });
  return NextResponse.json({ message: "If an account exists for that email, reset instructions have been sent." });
}
