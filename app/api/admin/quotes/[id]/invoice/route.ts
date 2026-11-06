import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const roles: UserRole[] = ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"];

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(roles);
  if (response || !user) return response;
  const { id } = await context.params;
  try {
    const quote = await prisma.quote.findUnique({ where: { id }, include: { invoice: true } });
    if (!quote) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    if (quote.invoice) return NextResponse.json({ error: "An invoice has already been issued for this quotation.", invoice: quote.invoice }, { status: 409 });
    if (quote.status !== "DRAFT" && quote.status !== "SENT") return NextResponse.json({ error: "An invoice can only be issued for a quotation awaiting customer approval." }, { status: 409 });
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          number: `EVPI-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          quoteId: id,
          status: "ISSUED",
          issuedAt: new Date(),
        },
      });
      await tx.quote.update({ where: { id }, data: { status: "SENT" } });
      if (quote.customerId) {
        await tx.notification.create({
          data: { userId: quote.customerId, type: "QUOTE", title: "New quotation available", message: `Quotation ${quote.number} and a pro forma invoice are ready in your account.` },
        });
      }
      return created;
    });
    await audit(user.id, "invoice.issued", "Invoice", invoice.id, { number: invoice.number, quoteId: id });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
