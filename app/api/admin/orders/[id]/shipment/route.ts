import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { shipmentSchema } from "@/lib/validation";

const roles: UserRole[] = ["SUPER_ADMIN", "LOGISTICS_MANAGER"];

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(roles);
  if (response || !user) return response;
  const { id } = await context.params;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check shipment details.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const order = await prisma.order.findUnique({ where: { id }, include: { shipment: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const values = parsed.data;
    const shipment = await prisma.$transaction(async (tx) => {
      const record = await tx.shipment.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          status: values.status,
          shippingCompany: values.shippingCompany,
          vessel: values.vessel,
          containerNumber: values.containerNumber,
          departurePort: values.departurePort,
          destinationPort: values.destinationPort,
          estimatedDeparture: values.estimatedDeparture ? new Date(values.estimatedDeparture) : null,
          estimatedArrival: values.estimatedArrival ? new Date(values.estimatedArrival) : null,
          trackingReference: values.trackingReference,
        },
        update: {
          status: values.status,
          shippingCompany: values.shippingCompany,
          vessel: values.vessel,
          containerNumber: values.containerNumber,
          departurePort: values.departurePort,
          destinationPort: values.destinationPort,
          estimatedDeparture: values.estimatedDeparture ? new Date(values.estimatedDeparture) : null,
          estimatedArrival: values.estimatedArrival ? new Date(values.estimatedArrival) : null,
          trackingReference: values.trackingReference,
        },
      });
      await tx.shipmentUpdate.create({ data: { shipmentId: record.id, status: values.status, message: values.updateMessage } });
      if (order.customerId) {
        await tx.notification.create({
          data: { userId: order.customerId, type: "SHIPMENT", title: "Shipment update", message: values.updateMessage },
        });
      }
      return record;
    });
    await audit(user.id, "shipment.updated", "Shipment", shipment.id, { orderId: id, status: shipment.status });
    return NextResponse.json({ shipment });
  } catch (error) {
    return safeError(error);
  }
}
