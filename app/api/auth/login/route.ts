import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await checkRateLimit(`login:${getClientAddress(request)}`, 10, 15 * 60 * 1000))) {
    return jsonError("Too many sign-in attempts. Try again later.", 429);
  }
  let input: unknown;
  try { input = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return jsonError("Invalid email or password.", 400);
  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return jsonError("Invalid email or password.", 401);
    }
    if (!user.emailVerifiedAt) return jsonError("Verify your email address before signing in.", 403);
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return safeError(error);
  }
}
