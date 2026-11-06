import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Authentication required.", 401), user: null };
  return { response: null, user };
}

export async function requireRole(roles: UserRole[]) {
  const result = await requireUser();
  if (result.response || !result.user) return result;
  if (!hasRole(result.user.role, roles)) {
    return { response: jsonError("You do not have permission to perform this action.", 403), user: null };
  }
  return result;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const bucketMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const bucket = new Date(bucketMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "bucket", "count")
    VALUES (${key}, ${bucket}, 1)
    ON CONFLICT ("key", "bucket") DO UPDATE
    SET "count" = "RateLimit"."count" + 1
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 0) <= limit;
}

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, ...(metadata ? { metadata } : {}) },
  });
}

export function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100);
}

export function safeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return jsonError("A record with those details already exists.", 409);
  }
  console.error("Request failed", error);
  return jsonError("The request could not be completed.", 500);
}
