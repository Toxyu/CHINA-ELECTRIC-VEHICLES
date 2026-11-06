import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";

export async function POST(request: Request) {
  if (!(await checkRateLimit(`password-reset-complete:${getClientAddress(request)}`, 5, 60 * 60 * 1000))) {
    return jsonError("Too many requests. Try again later.", 429);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  if (
    typeof body !== "object" || body === null ||
    !("token" in body) || typeof body.token !== "string" ||
    !("password" in body) || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128
  ) return jsonError("Provide a valid reset link and a password of at least 12 characters.", 400);

  try {
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
    if (!record || record.purpose !== "PASSWORD_RESET" || record.expiresAt <= new Date()) {
      return jsonError("This reset link is invalid or expired.", 400);
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
      prisma.verificationToken.deleteMany({ where: { userId: record.userId, purpose: "PASSWORD_RESET" } }),
    ]);
    return NextResponse.json({ message: "Password updated. Sign in with your new password." });
  } catch (error) {
    return safeError(error);
  }
}
