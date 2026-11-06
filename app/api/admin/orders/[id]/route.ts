import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const statusSchema = z.object({ status: z.nativeEnum(OrderStatus) });

const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ENQUIRY_RECEIVED: ["SOURCING_IN_PROGRESS", "CANCELLED"],
  SOURCING_IN_PROGRESS: ["QUOTATION_PREPARED", "CANCELLED"],
  QUOTATION_PREPARED: ["AWAITING_CUSTOMER_APPROVAL", "CANCELLED"],
  AWAITING_CUSTOMER_APPROVAL: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  PAYMENT_VERIFIED: ["VEHICLE_INSPECTION"],
  VEHICLE_INSPECTION: ["EXPORT_DOCUMENTATION"],
  EXPORT_DOCUMENTATION: ["READY_FOR_SHIPMENT"],
  READY_FOR_SHIPMENT: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED_AT_DESTINATION"],
  ARRIVED_AT_DESTINATION: ["COMPLETED"],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"]);
  if (response || !user) return response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Order status is required." }, { status: 400 });
  }
  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const next = parsed.data.status;
    if (!transitions[order.status]?.includes(next)) return NextResponse.json({ error: "That order status transition is not allowed." }, { status: 409 });
    if (["VEHICLE_INSPECTION", "EXPORT_DOCUMENTATION", "READY_FOR_SHIPMENT", "SHIPPED", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "COMPLETED"].includes(next) && user.role !== "LOGISTICS_MANAGER" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only logistics staff can update shipment-stage order status." }, { status: 403 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.order.update({ where: { id }, data: { status: next } });
      if (next === "CANCELLED" && order.quoteId) {
        await tx.invoice.updateMany({ where: { quoteId: order.quoteId, status: "ISSUED" }, data: { status: "VOID" } });
      }
      return saved;
    });
    await audit(user.id, "order.status_changed", "Order", id, { from: order.status, to: next });
    return NextResponse.json({ order: updated });
  } catch (error) {
    return safeError(error);
  }
}
