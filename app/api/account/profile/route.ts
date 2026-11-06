import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireUser, safeError } from "@/lib/http";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
});

export async function PATCH(request: Request) {
  const { response, user } = await requireUser();
  if (response || !user) return response;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Check profile details.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, phone: parsed.data.phone || null },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    await audit(user.id, "account.profile_updated", "User", user.id);
    return NextResponse.json({ user: updated });
  } catch (error) {
    return safeError(error);
  }
}
