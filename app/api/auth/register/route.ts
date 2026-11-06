import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { hashToken } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";

export async function POST(request: Request) {
  if (!(await checkRateLimit(`register:${getClientAddress(request)}`, 5, 60 * 60 * 1000))) {
    return jsonError("Too many registration attempts. Try again later.", 429);
  }
  let input: unknown;
  try { input = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check the registration details.", details: parsed.error.flatten() }, { status: 400 });

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
