import { NextResponse } from "next/server";
import { VehicleCondition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(48, Number(params.get("pageSize")) || 12));
  const q = params.get("q")?.trim().slice(0, 100);
  const manufacturer = params.get("manufacturer")?.trim().slice(0, 80);
  const bodyType = params.get("bodyType")?.trim().slice(0, 60);
  const condition = params.get("condition");
  const minPrice = Number(params.get("minPrice"));
  const maxPrice = Number(params.get("maxPrice"));
  const minYear = Number(params.get("minYear"));
  const maxYear = Number(params.get("maxYear"));
  const minRange = Number(params.get("minRange"));
  const maxRange = Number(params.get("maxRange"));
  const orderBy = params.get("sort") === "price-asc"
    ? { exportPrice: "asc" as const }
    : params.get("sort") === "year-desc"
      ? { year: "desc" as const }
      : { publishedAt: "desc" as const };

  try {
    const yearRange = {
      ...(Number.isFinite(minYear) && minYear > 1900 ? { gte: minYear } : {}),
      ...(Number.isFinite(maxYear) && maxYear > 1900 ? { lte: maxYear } : {}),
    };
    const priceRange = {
      ...(Number.isFinite(minPrice) && minPrice >= 0 ? { gte: minPrice } : {}),
      ...(Number.isFinite(maxPrice) && maxPrice >= 0 ? { lte: maxPrice } : {}),
    };
    const rangeRange = {
      ...(Number.isFinite(minRange) && minRange > 0 ? { gte: minRange } : {}),
      ...(Number.isFinite(maxRange) && maxRange > 0 ? { lte: maxRange } : {}),
    };
    const where = {
      availability: "AVAILABLE" as const,
      verifiedAt: { not: null },
      publishedAt: { not: null },
      ...(q ? { OR: [
        { model: { contains: q, mode: "insensitive" as const } },
        { stockReference: { contains: q, mode: "insensitive" as const } },
        { manufacturer: { name: { contains: q, mode: "insensitive" as const } } },
      ] } : {}),
      ...(manufacturer ? { manufacturer: { name: { equals: manufacturer, mode: "insensitive" as const } } } : {}),
      ...(bodyType ? { bodyType: { equals: bodyType, mode: "insensitive" as const } } : {}),
      ...(condition === "NEW" || condition === "USED" ? { condition: condition as VehicleCondition } : {}),
      ...(Object.keys(yearRange).length ? { year: yearRange } : {}),
      ...(Object.keys(priceRange).length ? { exportPrice: priceRange } : {}),
      ...(Object.keys(rangeRange).length ? { rangeKm: rangeRange } : {}),
    };
    const [vehicles, total, manufacturers, bodyTypes] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        select: {
          id: true, stockReference: true, model: true, year: true, condition: true, mileageKm: true,
          batteryKwh: true, rangeKm: true, chargingSpec: true, driveConfiguration: true, transmission: true,
          exteriorColour: true, interiorColour: true, description: true, bodyType: true, currency: true,
          exportPrice: true, manufacturer: { select: { name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 8, select: { url: true, alt: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vehicle.count({ where }),
      prisma.manufacturer.findMany({ where: { vehicles: { some: { availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } } } }, orderBy: { name: "asc" }, select: { name: true } }),
      prisma.vehicle.findMany({ where: { availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } }, distinct: ["bodyType"], orderBy: { bodyType: "asc" }, select: { bodyType: true } }),
    ]);
    return NextResponse.json({ vehicles, total, page, pageSize, pages: Math.ceil(total / pageSize), manufacturers: manufacturers.map((item) => item.name), bodyTypes: bodyTypes.map((item) => item.bodyType) });
  } catch (error) {
    return safeError(error);
  }
}
