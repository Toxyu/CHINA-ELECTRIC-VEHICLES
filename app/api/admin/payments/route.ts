import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const paymentSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  paymentMethod: z.string().trim().min(2).max(80),
  paymentReference: z.string().trim().min(3).max(160),
  notes: z.string().trim().max(500).optional(),
});
const paymentStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["VERIFIED", "FAILED", "REFUNDED"]),
});

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "FINANCE_OFFICER"]);
  if (response) return response;
  try {
    const payments = await prisma.payment.findMany({
      include: { order: { include: { customer: { select: { name: true, email: true } }, quote: true } }, verifiedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ payments });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "FINANCE_OFFICER"]);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check payment record details.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId }, include: { quote: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.quote && order.quote.currency !== parsed.data.currency) return NextResponse.json({ error: `Payment currency must match the order quotation (${order.quote.currency}).` }, { status: 400 });
    const payment = await prisma.payment.create({ data: { ...parsed.data, status: "PENDING" } });
    await audit(user.id, "payment.recorded_pending_verification", "Payment", payment.id, { orderId: order.id, reference: payment.paymentReference });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "FINANCE_OFFICER"]);
  if (response || !user) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = paymentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payment id and a valid verified payment status are required." }, { status: 400 });
  }
  const { id, status } = parsed.data;
  try {
    const prior = await prisma.payment.findUnique({
      where: { id },
      include: { order: { include: { quote: { include: { invoice: true } } } } },
    });
    if (!prior || prior.status !== "PENDING") return NextResponse.json({ error: "Only pending payment records can be verified or rejected." }, { status: 409 });
    const payment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status, verifiedById: user.id, verifiedAt: status === "VERIFIED" ? new Date() : null },
      });
      if (status === "VERIFIED" && prior.order.customerId) {
        await tx.notification.create({
          data: { userId: prior.order.customerId, type: "PAYMENT", title: "Payment verified", message: `The external payment record (${updated.paymentReference}) was verified by finance.` },
        });
      }
      if (status === "VERIFIED" && prior.order.quote) {
        const totals = await tx.payment.aggregate({ where: { orderId: prior.orderId, status: "VERIFIED" }, _sum: { amount: true } });
        if (Number(totals._sum.amount || 0) >= Number(prior.order.quote.total) && prior.order.status === "AWAITING_PAYMENT") {
          await tx.order.update({ where: { id: prior.orderId }, data: { status: "PAYMENT_VERIFIED" } });
          if (prior.order.quote.invoice) await tx.invoice.update({ where: { id: prior.order.quote.invoice.id }, data: { status: "PAID" } });
        }
      }
      return updated;
    });
    await audit(user.id, `payment.${status.toLowerCase()}`, "Payment", payment.id, { orderId: payment.orderId, amount: payment.amount.toString(), currency: payment.currency });
    return NextResponse.json({ payment });
  } catch (error) {
    return safeError(error);
  }
}
