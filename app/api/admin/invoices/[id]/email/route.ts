import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

const roles: UserRole[] = ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole(roles);
  if (response) return response;
  const { id } = await context.params;
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { quote: true } });
    if (!invoice || invoice.status !== "ISSUED") return NextResponse.json({ error: "Issued invoice not found." }, { status: 404 });
    if (!invoice.quote.customerEmail) return NextResponse.json({ error: "The quotation has no customer email address." }, { status: 400 });
    const link = `${process.env.APP_URL || new URL(request.url).origin}/account`;
    await sendTransactionalEmail(
      invoice.quote.customerEmail,
      `E.V China Global pro forma invoice ${invoice.number}`,
      `<p>Your pro forma invoice <strong>${invoice.number}</strong> is ready.</p><p><a href="${link}">Sign in to your account to view your quotation and download the invoice PDF</a>.</p><p>This document is an estimate, not a payment confirmation or customs declaration.</p>`,
    );
    return NextResponse.json({ sent: true });
  } catch (error) {
    return safeError(error);
  }
}
