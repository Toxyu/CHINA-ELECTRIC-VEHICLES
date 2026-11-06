import { z } from "zod";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const registerSchema = z.object({
  name: trimmed(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  phone: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const enquirySchema = z.object({
  name: trimmed(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  country: trimmed(100),
  cityOrPort: z.string().trim().max(120).optional(),
  vehicleBrief: trimmed(240),
  vehicleId: z.string().cuid().optional(),
  budget: z.string().trim().max(80).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  notes: z.string().trim().max(2_000).optional(),
});

export const vehicleSchema = z.object({
  stockReference: trimmed(60),
  manufacturer: trimmed(80),
  model: trimmed(120),
  trim: z.string().trim().max(120).optional(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  condition: z.enum(["NEW", "USED"]),
  mileageKm: z.number().int().min(0).max(2_000_000).default(0),
  batteryKwh: z.number().positive().max(500).optional(),
  rangeKm: z.number().int().positive().max(3_000).optional(),
  chargingSpec: z.string().trim().max(120).optional(),
  driveConfiguration: z.string().trim().max(40).optional(),
  transmission: z.string().trim().max(60).optional(),
  exteriorColour: z.string().trim().max(80).optional(),
  interiorColour: z.string().trim().max(80).optional(),
  vin: z.string().trim().max(80).optional(),
  description: trimmed(4_000),
  bodyType: trimmed(60),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  exportPrice: z.number().positive().max(100_000_000),
  supplierId: z.string().cuid().optional(),
  availability: z.enum(["PENDING_VERIFICATION", "AVAILABLE", "RESERVED", "SOLD", "ARCHIVED"]).default("PENDING_VERIFICATION"),
  verified: z.boolean().default(false),
  images: z.array(z.object({
    url: z.string().url().max(2_000).refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    alt: z.string().trim().max(180),
  })).max(20).default([]),
});

export const quoteSchema = z.object({
  enquiryId: z.string().cuid(),
  vehicleId: z.string().cuid(),
  destination: trimmed(100),
  destinationPort: z.string().trim().max(120).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  discountId: z.string().cuid().optional(),
  costReferences: z.string().trim().min(1).max(2_000),
  exportCosts: z.number().min(0).max(100_000_000).default(0),
  freight: z.number().min(0).max(100_000_000).default(0),
  insurance: z.number().min(0).max(100_000_000).default(0),
  taxesAndDuties: z.number().min(0).max(100_000_000).default(0),
  validDays: z.number().int().min(1).max(90).default(14),
});

export const shipmentSchema = z.object({
  status: z.enum(["PLANNED", "BOOKED", "DEPARTED", "IN_TRANSIT", "ARRIVED", "DELIVERED", "DELAYED"]),
  shippingCompany: z.string().trim().max(120).optional(),
  vessel: z.string().trim().max(120).optional(),
  containerNumber: z.string().trim().max(80).optional(),
  departurePort: z.string().trim().max(120).optional(),
  destinationPort: z.string().trim().max(120).optional(),
  estimatedDeparture: z.string().datetime().optional(),
  estimatedArrival: z.string().datetime().optional(),
  trackingReference: z.string().trim().max(120).optional(),
  updateMessage: trimmed(500),
});
