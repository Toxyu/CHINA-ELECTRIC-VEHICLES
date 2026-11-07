import { NextResponse } from "next/server"
import { safeError } from "@/lib/http"
import { isSupabaseConfigured, supabaseRequest } from "@/lib/supabase-admin"

function mapCar(car: Record<string, unknown>) {
  return {
    id: car.id,
    stockReference: car.stock_reference ?? car.stockReference ?? car.id,
    model: car.model ?? car.name ?? "Electric vehicle",
    year: car.year ?? null,
    condition: car.condition ?? "NEW",
    mileageKm: car.mileage_km ?? car.mileageKm ?? 0,
    batteryKwh: car.battery_kwh ?? car.batteryKwh ?? null,
    rangeKm: car.range_km ?? car.rangeKm ?? null,
    chargingSpec: car.charging_spec ?? car.chargingSpec ?? null,
    driveConfiguration: car.drive_configuration ?? car.driveConfiguration ?? null,
    transmission: car.transmission ?? null,
    exteriorColour: car.exterior_colour ?? car.exteriorColour ?? null,
    interiorColour: car.interior_colour ?? car.interiorColour ?? null,
    description: car.description ?? null,
    bodyType: car.body_type ?? car.bodyType ?? null,
    currency: car.currency ?? "KES",
    exportPrice: car.export_price ?? car.exportPrice ?? car.price_kes ?? car.price ?? 0,
    manufacturer: { name: car.manufacturer ?? car.make ?? "China EV" },
    images: Array.isArray(car.images) ? car.images : car.image_url ? [{ url: car.image_url, alt: car.model ?? "Electric vehicle" }] : [],
    availability: car.availability ?? "AVAILABLE",
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1))
  const pageSize = Math.max(1, Math.min(48, Number(params.get("pageSize")) || 12))

  try {
    if (isSupabaseConfigured()) {
      const rows = await supabaseRequest<Record<string, unknown>[]>("cars?select=*&availability=eq.AVAILABLE&order=created_at.desc")
      const mapped = rows.map(mapCar)
      const q = params.get("q")?.trim().toLowerCase()
      const filtered = q ? mapped.filter((car) => `${car.model} ${car.manufacturer.name} ${car.stockReference}`.toLowerCase().includes(q)) : mapped
      const start = (page - 1) * pageSize
      const vehicles = filtered.slice(start, start + pageSize)
      return NextResponse.json({ vehicles, total: filtered.length, page, pageSize, pages: Math.ceil(filtered.length / pageSize), manufacturers: [...new Set(filtered.map((car) => car.manufacturer.name))], bodyTypes: [...new Set(filtered.map((car) => car.bodyType).filter(Boolean))] })
    }

    return NextResponse.json({ vehicles: [], total: 0, page, pageSize, pages: 0, manufacturers: [], bodyTypes: [], error: "Supabase inventory is not configured" }, { status: 503 })
  } catch (error) {
    return NextResponse.json({ vehicles: [], total: 0, page, pageSize, pages: 0, manufacturers: [], bodyTypes: [], error: "Inventory is temporarily unavailable" }, { status: 503 })
  }
}
