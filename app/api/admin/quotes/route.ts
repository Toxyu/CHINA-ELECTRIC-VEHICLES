import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { audit, requireRole, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { quoteSchema } from "@/lib/validation";
import { calculateCommercialDiscount, calculateQuoteTotal } from "@/lib/quote-calculations.mjs";

const roles: UserRole[] = ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"];

export async function GET() {
  const { response } = await requireRole(roles);
  if (response) return response;
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        customer: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, stockReference: true, model: true, trim: true, year: true, currency: true, exportPrice: true, manufacturer: { select: { name: true } } } },
        invoice: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return NextResponse.json({ quotes });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  const { response, user } = await requireRole(roles);
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check quotation details.", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } },
      include: { manufacturer: true, images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!vehicle) return NextResponse.json({ error: "Only verified, available vehicles can be quoted." }, { status: 409 });
    if (vehicle.currency !== data.currency) return NextResponse.json({ error: `Quote currency must match verified vehicle currency (${vehicle.currency}). No currency conversion is configured.` }, { status: 400 });

    let customerId: string | null = null;
    let customerName = "Customer";
    let customerEmail = "";
    if (data.enquiryId) {
      const enquiry = await prisma.enquiry.findUnique({ where: { id: data.enquiryId } });
      if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
      if (enquiry.status === "CLOSED") return NextResponse.json({ error: "A closed enquiry cannot receive a new quotation." }, { status: 409 });
      customerId = enquiry.userId;
      customerName = enquiry.name;
      customerEmail = enquiry.email;
    }

    let discountAmount = 0;
    let discountSnapshot: Record<string, string> | null = null;
    let discountForUse: { id: string; maxUses: number | null } | null = null;
    if (data.discountId) {
      const discount = await prisma.discount.findUnique({ where: { id: data.discountId } });
      const now = new Date();
      if (!discount || !discount.active || (discount.startsAt && discount.startsAt > now) || (discount.expiresAt && discount.expiresAt < now) || (discount.maxUses !== null && discount.uses >= discount.maxUses)) {
        return NextResponse.json({ error: "The selected discount is not currently valid or approved." }, { status: 400 });
      }
      if (discount.vehicleId && discount.vehicleId !== vehicle.id) return NextResponse.json({ error: "The discount does not apply to this vehicle." }, { status: 400 });
      if (discount.manufacturerId && discount.manufacturerId !== vehicle.manufacturerId) return NextResponse.json({ error: "The discount does not apply to this manufacturer." }, { status: 400 });
      if (discount.currency && discount.currency !== data.currency) return NextResponse.json({ error: "The discount currency does not match the vehicle price." }, { status: 400 });
      if (discount.kind !== "PERCENT" && discount.kind !== "FIXED") return NextResponse.json({ error: "The selected discount type is invalid." }, { status: 400 });
      discountAmount = calculateCommercialDiscount(vehicle.exportPrice.toString(), discount.kind, discount.value.toString());
      discountForUse = { id: discount.id, maxUses: discount.maxUses };
      discountSnapshot = { name: discount.name, code: discount.code || "", kind: discount.kind, value: discount.value.toString() };
    }

    const vehiclePrice = Number(vehicle.exportPrice);
    const total = calculateQuoteTotal({
      vehiclePrice,
      discountAmount,
      exportCosts: data.exportCosts,
      freight: data.freight,
      insurance: data.insurance,
      taxesAndDuties: data.taxesAndDuties,
    });
    const number = `EVQ-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const quote = await prisma.$transaction(async (tx) => {
      const record = await tx.quote.create({
        data: {
          number,
          customerId,
          enquiryId: data.enquiryId,
          vehicleId: vehicle.id,
          customerName,
          customerEmail,
          destination: data.destination,
          destinationPort: data.destinationPort,
          currency: data.currency,
          vehicleSnapshot: {
            stockReference: vehicle.stockReference,
            manufacturer: vehicle.manufacturer.name,
            model: vehicle.model,
            trim: vehicle.trim,
            year: vehicle.year,
            condition: vehicle.condition,
            description: vehicle.description,
          },
          priceSnapshot: {
            vehiclePrice,
            discountAmount,
            discount: discountSnapshot,
            costReferences: data.costReferences,
            exportCosts: data.exportCosts,
            freight: data.freight,
            insurance: data.insurance,
            taxesAndDuties: data.taxesAndDuties,
            total,
            currency: data.currency,
          },
          vehiclePrice,
          discountAmount,
          exportCosts: data.exportCosts,
          freight: data.freight,
          insurance: data.insurance,
          taxesAndDuties: data.taxesAndDuties,
          total,
          validUntil: new Date(Date.now() + data.validDays * 24 * 60 * 60 * 1000),
        },
      });
      if (discountForUse?.maxUses !== null && discountForUse) {
        const updated = await tx.discount.updateMany({
          where: { id: discountForUse.id, uses: { lt: discountForUse.maxUses } },
          data: { uses: { increment: 1 } },
        });
        if (updated.count !== 1) throw new Error("Discount usage limit reached.");
      } else if (discountForUse) {
        await tx.discount.update({ where: { id: discountForUse.id }, data: { uses: { increment: 1 } } });
      }
      if (data.enquiryId) await tx.enquiry.update({ where: { id: data.enquiryId }, data: { status: "QUOTED" } });
      return record;
    });
    await audit(user.id, "quote.created", "Quote", quote.id, { number: quote.number });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
