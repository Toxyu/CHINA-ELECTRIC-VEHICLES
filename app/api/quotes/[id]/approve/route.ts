import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  const { id } = await context.params;
  try {
    const quote = await prisma.quote.findFirst({
      where: { id, customerId: user.id, status: "SENT", validUntil: { gt: new Date() }, invoice: { isNot: null } },
      include: { invoice: true },
    });
    if (!quote) return NextResponse.json({ error: "This quotation is unavailable, expired, or not awaiting your approval." }, { status: 404 });
    const order = await prisma.$transaction(async (tx) => {
      const approved = await tx.quote.updateMany({
        where: { id, customerId: user.id, status: "SENT", validUntil: { gt: new Date() } },
        data: { status: "APPROVED" },
      });
      if (approved.count !== 1) return null;
      return tx.order.create({
        data: {
          number: `EVO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          customerId: user.id,
          quoteId: id,
          status: "AWAITING_PAYMENT",
          destination: quote.destination,
        },
      });
    });
    if (!order) return NextResponse.json({ error: "This quotation was already approved or has expired." }, { status: 409 });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
