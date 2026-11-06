import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
const password = process.env.STAFF_PASSWORD;
const name = process.env.STAFF_NAME?.trim();
const role = process.env.STAFF_ROLE;
const roles = ["INVENTORY_MANAGER", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"];

try {
  if (!email || !password || !name || password.length < 16 || !roles.includes(role || "")) {
    throw new Error("Set STAFF_EMAIL, STAFF_NAME, STAFF_ROLE (inventory/sales/finance/logistics role), and a 16+ character STAFF_PASSWORD.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("That email already has an account; staff provisioning only creates a new staff account.");
  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await prisma.user.create({
    data: { email, name, passwordHash, role, emailVerifiedAt: new Date() },
    select: { email: true, role: true },
  });
  console.log(`Created staff account ${staff.email} (${staff.role}). Remove provisioning secrets from the environment.`);
} finally {
  await prisma.$disconnect();
}
