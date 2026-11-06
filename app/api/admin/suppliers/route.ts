import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const roles: UserRole[] = ["SUPER_ADMIN", "INVENTORY_MANAGER"];
const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  country: z.string().trim().min(2).max(100).default("China"),
  contactName: z.string().trim().max(120).optional(),
  email: z.preprocess((value) => value === "" ? undefined : value, z.string().email().max(254).optional()),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2_000).optional(),
  active: z.boolean().default(true),
});

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER"]);
  if (response) return response;
  try {
    const suppliers = await prisma.supplier.findMany({ include: { _count: { select: { vehicles: true } } }, orderBy: { name: "asc" } });
    return NextResponse.json({ suppliers });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireRole(roles);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check supplier details.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const supplier = await prisma.supplier.create({ data: parsed.data });
    await audit(user.id, "supplier.created", "Supplier", supplier.id);
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
