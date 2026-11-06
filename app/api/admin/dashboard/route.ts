import { NextResponse } from "next/server";
import { requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const staff = ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"] as const;

export async function GET() {
  const { response, user } = await requireRole([...staff]);
  if (response || !user) return response;
  try {
    const [vehicles, activeListings, pendingEnquiries, customers, pendingQuotes, issuedInvoices, confirmedOrders, shipments, paidInvoices, recentActivity] = await Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } } }),
      prisma.enquiry.count({ where: { status: { in: ["RECEIVED", "SOURCING"] } } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
      prisma.invoice.count({ where: { status: { in: ["ISSUED", "PAID"] } } }),
      prisma.order.count({ where: { status: { notIn: ["CANCELLED", "COMPLETED"] } } }),
      prisma.shipment.count({ where: { status: { in: ["BOOKED", "DEPARTED", "IN_TRANSIT", "DELAYED"] } } }),
      prisma.invoice.findMany({ where: { status: "PAID" }, include: { quote: { select: { currency: true, total: true } } } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true, email: true } } } }),
    ]);
    const revenueByCurrency = user.role === "SUPER_ADMIN" || user.role === "FINANCE_OFFICER" ? Object.entries(paidInvoices.reduce<Record<string, number>>((acc, invoice) => {
      acc[invoice.quote.currency] = (acc[invoice.quote.currency] || 0) + Number(invoice.quote.total);
      return acc;
    }, {})) : [];
    return NextResponse.json({ metrics: { vehicles, activeListings, pendingEnquiries, customers, pendingQuotes, issuedInvoices, confirmedOrders, shipments, revenueByCurrency }, recentActivity });
  } catch (error) {
    return safeError(error);
  }
}
