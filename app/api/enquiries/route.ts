import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientAddress, jsonError, safeError } from "@/lib/http";
import { enquirySchema } from "@/lib/validation";

export async function POST(request: Request) {
  let input: unknown;
  try {
    const allowed = await checkRateLimit(`enquiry:${getClientAddress(request)}`, 8, 60 * 60 * 1000).catch(() => true);
    if (!allowed) return jsonError("Too many enquiries. Please try again later.", 429);
    input = await request.json();
  } catch {
    return jsonError("Invalid JSON request.", 400);
  }
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check the enquiry details.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const user = await getCurrentUser();
    if (user && parsed.data.email !== user.email) {
      return jsonError("Use the email address on your signed-in account, or sign out to submit a separate enquiry.", 400);
    }
    if (parsed.data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: parsed.data.vehicleId, availability: "AVAILABLE", verifiedAt: { not: null }, publishedAt: { not: null } },
        select: { id: true },
      });
      if (!vehicle) return jsonError("The selected vehicle is no longer available for enquiry.", 404);
    }
    const enquiry = await prisma.enquiry.create({
      data: { ...parsed.data, userId: user?.emailVerifiedAt ? user.id : null },
      select: { id: true, status: true, createdAt: true },
    });
    return NextResponse.json({ enquiry, message: "Your enquiry has been received. Our team will verify availability and pricing." }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}
