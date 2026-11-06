import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { vehicleSchema } from "@/lib/validation";

const inventoryRoles: UserRole[] = ["SUPER_ADMIN", "INVENTORY_MANAGER"];

export async function GET() {
  const { response, user } = await requireRole(["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER", "LOGISTICS_MANAGER"]);
  if (response || !user) return response;
  try {
    const vehicles = user.role === "SALES_MANAGER"
      ? await prisma.vehicle.findMany({
        select: {
          id: true, stockReference: true, model: true, trim: true, year: true, condition: true,
          mileageKm: true, batteryKwh: true, rangeKm: true, chargingSpec: true, driveConfiguration: true,
          transmission: true, exteriorColour: true, interiorColour: true, description: true, bodyType: true,
          currency: true, exportPrice: true, availability: true, verifiedAt: true, publishedAt: true,
          createdAt: true, updatedAt: true,
          manufacturer: { select: { name: true } },
          images: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 250,
      })
      : await prisma.vehicle.findMany({
        include: { manufacturer: true, supplier: true, images: { orderBy: { sortOrder: "asc" } } },
        orderBy: { updatedAt: "desc" },
        take: 250,
      });
    return NextResponse.json({ vehicles });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireRole(inventoryRoles);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check the vehicle details.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.availability === "AVAILABLE" && !parsed.data.verified) {
    return NextResponse.json({ error: "A listing must be verified before it can be marked available." }, { status: 400 });
  }
  try {
    const { manufacturer, images, verified, ...data } = parsed.data;
    const maker = await prisma.manufacturer.upsert({
      where: { slug: manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") },
      update: { name: manufacturer },
      create: { name: manufacturer, slug: manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        manufacturerId: maker.id,
        verifiedAt: verified ? new Date() : null,
        publishedAt: data.availability === "AVAILABLE" ? new Date() : null,
        images: { create: images.map((image, sortOrder) => ({ ...image, sortOrder })) },
      },
    });
    await audit(user.id, "vehicle.created", "Vehicle", vehicle.id, { stockReference: vehicle.stockReference });
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
