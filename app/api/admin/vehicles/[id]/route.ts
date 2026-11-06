import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { vehicleSchema } from "@/lib/validation";

const inventoryRoles: UserRole[] = ["SUPER_ADMIN", "INVENTORY_MANAGER"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(inventoryRoles);
  if (response || !user) return response;
  const { id } = await context.params;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check the vehicle details.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.availability === "AVAILABLE" && !parsed.data.verified) return NextResponse.json({ error: "A listing must be verified before it can be marked available." }, { status: 400 });
  try {
    const { manufacturer, images, verified, ...data } = parsed.data;
    const slug = manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const maker = await prisma.manufacturer.upsert({ where: { slug }, update: { name: manufacturer }, create: { slug, name: manufacturer } });
    const vehicle = await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.deleteMany({ where: { vehicleId: id } });
      return tx.vehicle.update({
        where: { id },
        data: {
          ...data,
          manufacturerId: maker.id,
          verifiedAt: verified ? new Date() : null,
          publishedAt: data.availability === "AVAILABLE" ? new Date() : null,
          images: { create: images.map((image, sortOrder) => ({ ...image, sortOrder })) },
        },
      });
    });
    await audit(user.id, "vehicle.updated", "Vehicle", id, { stockReference: vehicle.stockReference });
    return NextResponse.json({ vehicle });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(inventoryRoles);
  if (response || !user) return response;
  const { id } = await context.params;
  try {
    const vehicle = await prisma.vehicle.update({ where: { id }, data: { availability: "ARCHIVED", publishedAt: null } });
    await audit(user.id, "vehicle.archived", "Vehicle", id);
    return NextResponse.json({ id: vehicle.id, availability: vehicle.availability });
  } catch (error) {
    return safeError(error);
  }
}
