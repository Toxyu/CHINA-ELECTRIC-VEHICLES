import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const discountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).optional(),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive().max(100_000_000),
  currency: z.string().length(3).optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().max(1_000_000).optional(),
  vehicleId: z.string().cuid().optional(),
});

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"]);
  if (response) return response;
  try {
    const discounts = await prisma.discount.findMany({
      include: {
        vehicle: { select: { id: true, stockReference: true, model: true, year: true, manufacturer: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ discounts });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER"]);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check discount details.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.kind === "PERCENT" && parsed.data.value > 100) return NextResponse.json({ error: "Percentage discounts cannot exceed 100%." }, { status: 400 });
  try {
    const d = parsed.data;
    const discount = await prisma.discount.create({
      data: {
        name: d.name,
        code: d.code ? d.code.toUpperCase() : undefined,
        kind: d.kind,
        value: d.value,
        currency: d.currency?.toUpperCase(),
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        maxUses: d.maxUses,
        vehicleId: d.vehicleId,
        active: user.role === "SUPER_ADMIN",
        approvedById: user.role === "SUPER_ADMIN" ? user.id : null,
      },
    });
    await audit(user.id, "discount.created", "Discount", discount.id, { active: discount.active });
    return NextResponse.json({ discount }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN"]);
  if (response || !user) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "string" || !("active" in body) || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Discount id and approval state are required." }, { status: 400 });
  }
  try {
    const discount = await prisma.discount.update({ where: { id: body.id }, data: { active: body.active, approvedById: body.active ? user.id : null } });
    await audit(user.id, body.active ? "discount.approved" : "discount.revoked", "Discount", discount.id);
    return NextResponse.json({ discount });
  } catch (error) {
    return safeError(error);
  }
}
