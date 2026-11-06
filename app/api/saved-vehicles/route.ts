import { NextResponse } from "next/server";
import { requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("vehicleId" in body) || typeof body.vehicleId !== "string") {
    return NextResponse.json({ error: "Vehicle is required." }, { status: 400 });
  }
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: body.vehicleId, availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } }, select: { id: true } });
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    const existing = await prisma.savedVehicle.findUnique({ where: { userId_vehicleId: { userId: user.id, vehicleId: vehicle.id } } });
    if (existing) {
      await prisma.savedVehicle.delete({ where: { userId_vehicleId: { userId: user.id, vehicleId: vehicle.id } } });
      return NextResponse.json({ saved: false });
    }
    await prisma.savedVehicle.create({ data: { userId: user.id, vehicleId: vehicle.id } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return safeError(error);
  }
}
