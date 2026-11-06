import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } },
      select: {
        id: true, stockReference: true, model: true, trim: true, year: true, condition: true, mileageKm: true,
        batteryKwh: true, rangeKm: true, chargingSpec: true, driveConfiguration: true, transmission: true,
        exteriorColour: true, interiorColour: true, description: true, bodyType: true, currency: true,
        exportPrice: true, manufacturer: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      },
    });
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    const similar = await prisma.vehicle.findMany({
      where: { id: { not: id }, availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null }, bodyType: vehicle.bodyType },
      select: {
        id: true, model: true, year: true, bodyType: true, currency: true, exportPrice: true,
        manufacturer: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
      },
      take: 3,
      orderBy: { publishedAt: "desc" },
    });
    return NextResponse.json({ vehicle, similar });
  } catch (error) {
    return safeError(error);
  }
}
