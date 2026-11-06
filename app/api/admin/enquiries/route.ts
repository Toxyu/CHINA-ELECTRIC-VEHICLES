import { NextResponse } from "next/server";
import { EnquiryStatus } from "@prisma/client";
import { z } from "zod";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  const { response } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER"]);
  if (response) return response;
  try {
    const enquiries = await prisma.enquiry.findMany({
      include: {
        vehicle: { select: { id: true, stockReference: true, model: true, year: true, manufacturer: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    const vehicles = await prisma.vehicle.findMany({
      where: { availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } },
      include: { manufacturer: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ enquiries, vehicles });
  } catch (error) {
    return safeError(error);
  }
}

const enquiryStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["RECEIVED", "SOURCING", "QUOTED", "CLOSED"]),
});

const enquiryTransitions: Record<EnquiryStatus, EnquiryStatus[]> = {
  RECEIVED: ["SOURCING", "CLOSED"],
  SOURCING: ["CLOSED"],
  QUOTED: ["CLOSED"],
  CLOSED: [],
};

export async function PATCH(request: Request) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "SALES_MANAGER"]);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = enquiryStatusSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Enquiry id and valid status are required." }, { status: 400 });
  try {
    const current = await prisma.enquiry.findUnique({ where: { id: parsed.data.id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    if (!enquiryTransitions[current.status].includes(parsed.data.status)) {
      return NextResponse.json({ error: "That enquiry status transition is not allowed." }, { status: 409 });
    }
    const updated = await prisma.enquiry.updateMany({
      where: { id: parsed.data.id, status: current.status },
      data: { status: parsed.data.status },
    });
    if (updated.count !== 1) return NextResponse.json({ error: "The enquiry changed before this update; reload and try again." }, { status: 409 });
    await audit(user.id, "enquiry.status_changed", "Enquiry", parsed.data.id, { from: current.status, to: parsed.data.status });
    return NextResponse.json({ updated: true });
  } catch (error) {
    return safeError(error);
  }
}
