import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim();

try {
  if (!email || !password || !name || password.length < 16) {
    throw new Error("Set ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_NAME, and a 16+ character ADMIN_BOOTSTRAP_PASSWORD.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("That email already has an account; bootstrap only creates a new administrator.");
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: { email, name, passwordHash, role: "SUPER_ADMIN", emailVerifiedAt: new Date() },
    select: { id: true, email: true, role: true },
  });
  console.log(`Created the first administrator: ${admin.email} (${admin.role}). Remove bootstrap secrets from the environment.`);
} finally {
  await prisma.$disconnect();
}
