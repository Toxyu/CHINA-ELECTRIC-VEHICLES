import { NextResponse } from "next/server";
import { requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  try {
    const updated = await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    if (!updated.count) return NextResponse.json({ error: "Notification not found or already read." }, { status: 404 });
    return NextResponse.json({ read: true });
  } catch (error) {
    return safeError(error);
  }
}
