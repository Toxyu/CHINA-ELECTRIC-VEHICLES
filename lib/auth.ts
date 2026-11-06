import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-evcg_session" : "evcg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const staffRoles = new Set<UserRole>([
  "SUPER_ADMIN",
  "INVENTORY_MANAGER",
  "SALES_MANAGER",
  "FINANCE_OFFICER",
  "LOGISTICS_MANAGER",
]);

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, user: { isActive: true } },
    include: { user: { select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true } } },
  });
  if (!session) return null;
  return session.user;
}

export function hasRole(role: UserRole, allowed: UserRole[]) {
  return role === "SUPER_ADMIN" || allowed.includes(role);
}

export function isStaff(role: UserRole) {
  return staffRoles.has(role);
}
