import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { hashToken } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";

async function registerWithSupabase(input: { name: string; email: string; phone?: string; password: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.email, password: input.password, data: { full_name: input.name, phone: input.phone || null } }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data: { user?: { id?: string; email?: string }; msg?: string; error?: string; error_code?: string; error_description?: string } = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const message = data.error_description || data.msg || data.error || "Supabase signup failed.";
    console.error("SIGNUP_ERROR", response.status, message, data.error_code);
    return { error: message, code: data.error_code };
  }

  if (data.user?.id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ id: data.user.id, full_name: input.name, phone: input.phone || null, role: "CUSTOMER" }),
      });
    } catch (error) {
      console.error("Supabase profile insert failed", error);
    }
  }

  return { message: "Account created. Check your email to confirm your address before signing in." };
}

export async function POST(request: Request) {
  try {
    if (!(await checkRateLimit(`register:${getClientAddress(request)}`, 5, 60 * 60 * 1000))) {
      return jsonError("Too many registration attempts. Try again later.", 429);
    }
  } catch (error) {
    console.error("Registration rate limit persistence unavailable", error);
  }

  let input: unknown;
  try { input = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check the registration details.", details: parsed.error.flatten() }, { status: 400 });

  try {
    const supabaseResult = await registerWithSupabase(parsed.data);
    if (supabaseResult) {
      return supabaseResult.error
        ? NextResponse.json({ error: supabaseResult.error }, { status: 400 })
        : NextResponse.json({ message: supabaseResult.message }, { status: 201 });
    }
  } catch (error) {
    console.error("Supabase signup request failed", error);
    return NextResponse.json({ error: "We could not create the account. Please try again." }, { status: 502 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return jsonError("An account with that email already exists.", 409);

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const token = randomBytes(32).toString("base64url");
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        passwordHash,
        verificationTokens: {
          create: {
            tokenHash: hashToken(token),
            purpose: "EMAIL_VERIFICATION",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    const verifyUrl = `${process.env.APP_URL || new URL(request.url).origin}/verify?token=${encodeURIComponent(token)}`;
    if (process.env.NODE_ENV === "production") {
      await sendTransactionalEmail(user.email, "Verify your E.V China Global account", `<p>Confirm your email to activate your account.</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`);
    }
    return NextResponse.json({
      message: "Registration received. Verify your email before signing in.",
      ...(process.env.NODE_ENV !== "production" ? { verificationUrl: verifyUrl } : {}),
    }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
