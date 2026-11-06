import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER"]);
  if (response) return response;
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, isActive: true, createdAt: true, _count: { select: { enquiries: true, quotes: true, orders: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ customers });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER"]);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = z.object({ id: z.string().cuid(), isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Customer id and active state are required." }, { status: 400 });
  try {
    const customer = await prisma.user.findFirst({ where: { id: parsed.data.id, role: "CUSTOMER" }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.user.update({ where: { id: customer.id }, data: { isActive: parsed.data.isActive }, select: { id: true, isActive: true } });
      if (!parsed.data.isActive) await tx.session.deleteMany({ where: { userId: customer.id } });
      return record;
    });
    await audit(user.id, parsed.data.isActive ? "customer.activated" : "customer.deactivated", "User", customer.id);
    return NextResponse.json({ customer: updated });
  } catch (error) {
    return safeError(error);
  }
}
