import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";

export async function POST(request: Request) {
  if (!(await checkRateLimit(`password-reset:${getClientAddress(request)}`, 5, 60 * 60 * 1000))) {
    return jsonError("Too many requests. Try again later.", 429);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  if (typeof body !== "object" || body === null || !("email" in body) || typeof body.email !== "string" || body.email.length > 254) {
    return jsonError("Enter a valid email address.", 400);
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    let resetUrl: string | undefined;
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await prisma.verificationToken.deleteMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          purpose: "PASSWORD_RESET",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      resetUrl = `${process.env.APP_URL || new URL(request.url).origin}/reset-password?token=${encodeURIComponent(token)}`;
      if (process.env.NODE_ENV === "production") {
        await sendTransactionalEmail(user.email, "Reset your E.V China Global password", `<p>Use this link to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`);
      }
    }
    return NextResponse.json({
      message: "If an account exists for that email, password reset instructions have been sent.",
      ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}),
    });
  } catch (error) {
    return safeError(error);
  }
}
