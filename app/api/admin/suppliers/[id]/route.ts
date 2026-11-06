import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "INVENTORY_MANAGER"]);
  if (response || !user) return response;
  const { id } = await context.params;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = z.object({ active: z.boolean() }).safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Supplier active state is required." }, { status: 400 });
  try {
    const supplier = await prisma.supplier.update({ where: { id }, data: { active: parsed.data.active } });
    await audit(user.id, parsed.data.active ? "supplier.activated" : "supplier.deactivated", "Supplier", id);
    return NextResponse.json({ supplier });
  } catch (error) {
    return safeError(error);
  }
}
