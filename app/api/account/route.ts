import { NextResponse } from "next/server";
import { requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  try {
    const [enquiries, quotes, orders, savedVehicles, notifications] = await Promise.all([
      prisma.enquiry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.quote.findMany({ where: { customerId: user.id }, include: { vehicle: { include: { manufacturer: true, images: { take: 1 } } }, invoice: true }, orderBy: { createdAt: "desc" } }),
      prisma.order.findMany({
        where: { customerId: user.id },
        include: {
          shipment: { include: { updates: { orderBy: { occurredAt: "desc" }, take: 10 } } },
          quote: true,
          payments: { where: { status: "VERIFIED" }, select: { amount: true, currency: true, status: true, verifiedAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.savedVehicle.findMany({
        where: { userId: user.id },
        select: {
          vehicle: {
            select: {
              id: true, model: true, year: true,
              manufacturer: { select: { name: true } },
              images: { take: 1, select: { url: true, alt: true } },
            },
          },
        },
      }),
      prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } });
    return NextResponse.json({ user: { ...user, phone: profile?.phone || "" }, enquiries, quotes, orders, savedVehicles, notifications });
  } catch (error) {
    return safeError(error);
  }
}
