import { NextResponse } from "next/server";
import { requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  try {
    const quotes = user.role === "SUPER_ADMIN" || user.role === "SALES_MANAGER" || user.role === "FINANCE_OFFICER"
      ? await prisma.quote.findMany({ include: { invoice: true, vehicle: { include: { manufacturer: true } } }, orderBy: { createdAt: "desc" }, take: 100 })
      : await prisma.quote.findMany({ where: { customerId: user.id }, include: { invoice: true, vehicle: { include: { manufacturer: true } } }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ quotes });
  } catch (error) {
    return safeError(error);
  }
}
