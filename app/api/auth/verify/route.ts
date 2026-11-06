import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, safeError } from "@/lib/http";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON request.", 400); }
  if (typeof body !== "object" || body === null || !("token" in body) || typeof body.token !== "string" || body.token.length > 200) {
    return jsonError("Invalid verification link.", 400);
  }
  try {
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
    if (!record || record.purpose !== "EMAIL_VERIFICATION" || record.expiresAt <= new Date()) {
      return jsonError("This verification link is invalid or expired.", 400);
    }
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await tx.verificationToken.delete({ where: { id: record.id } });
      await tx.enquiry.updateMany({ where: { email: user.email, userId: null }, data: { userId: user.id } });
      await tx.quote.updateMany({ where: { customerEmail: user.email, customerId: null }, data: { customerId: user.id } });
    });
    return NextResponse.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    return safeError(error);
  }
}
