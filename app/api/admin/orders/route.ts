import { NextResponse } from "next/server";
import { requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"]);
  if (response) return response;
  try {
    const orders = await prisma.order.findMany({
      include: { customer: { select: { name: true, email: true } }, quote: true, shipment: { include: { updates: { orderBy: { occurredAt: "desc" }, take: 5 } } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ orders });
  } catch (error) {
    return safeError(error);
  }
}
