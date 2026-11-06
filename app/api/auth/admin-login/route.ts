import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

const staffRoles = ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"];

export async function POST(request: Request) {
  if (!(await checkRateLimit(`admin-login:${getClientAddress(request)}`, 8, 15 * 60 * 1000))) {
    return jsonError("Too many sign-in attempts. Try again later.", 429);
  }
  let input: unknown;
  try { input = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return jsonError("Invalid email or password.", 400);
  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.isActive || !staffRoles.includes(user.role) || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return jsonError("Invalid email or password.", 401);
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return safeError(error);
  }
}
