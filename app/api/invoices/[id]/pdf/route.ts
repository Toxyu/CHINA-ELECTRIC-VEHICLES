import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, safeError } from "@/lib/http";

function wrap(text: string, maxLength: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id } = await context.params;
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { quote: true } });
    if (!invoice) return jsonError("Invoice not found.", 404);
    const privileged = ["SUPER_ADMIN", "FINANCE_OFFICER", "SALES_MANAGER"].includes(user.role);
    if (!privileged && invoice.quote.customerId !== user.id) return jsonError("Invoice not found.", 404);

    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    const line = (text: string, options: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb> } = {}) => {
      if (y < 55) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(text, { x: 48, y, size: options.size ?? 10, font: options.font ?? regular, color: options.color ?? rgb(0.13, 0.18, 0.14), maxWidth: 495 });
      y -= (options.size ?? 10) + 10;
    };
    const money = (amount: number) => `${invoice.quote.currency} ${amount.toFixed(2)}`;
    const snapshot = invoice.quote.vehicleSnapshot as Record<string, unknown>;
    const costs = invoice.quote.priceSnapshot as { discount?: { name?: string } | null };
    line("E.V CHINA GLOBAL", { size: 20, font: bold });
    if (process.env.COMPANY_LEGAL_NAME) line(process.env.COMPANY_LEGAL_NAME, { size: 10, font: bold });
    const contactLine = [process.env.COMPANY_EMAIL, process.env.COMPANY_PHONE, process.env.COMPANY_ADDRESS].filter(Boolean).join(" | ");
    if (contactLine) line(contactLine, { size: 8 });
    line("PRO FORMA INVOICE - NOT A TAX INVOICE", { size: 11, font: bold, color: rgb(0.48, 0.34, 0.12) });
    line(`Invoice: ${invoice.number}   Quote: ${invoice.quote.number}`);
    line(`Issued: ${invoice.issuedAt?.toISOString().slice(0, 10) ?? "Draft"}   Valid until: ${invoice.quote.validUntil?.toISOString().slice(0, 10) ?? "Not specified"}`);
    y -= 10;
    line("CUSTOMER AND DESTINATION", { font: bold });
    line(`${invoice.quote.customerName}  |  ${invoice.quote.customerEmail || "Email not provided"}`);
    line(`${invoice.quote.destination}${invoice.quote.destinationPort ? `, ${invoice.quote.destinationPort}` : ""}`);
    y -= 10;
    line("VEHICLE (SNAPSHOT AT QUOTATION)", { font: bold });
    line(`${snapshot.manufacturer || ""} ${snapshot.model || ""} ${snapshot.trim || ""} (${snapshot.year || ""})`);
    line(`Stock reference: ${snapshot.stockReference || "Not recorded"}   VIN: available to authorised staff on request`);
    y -= 10;
    line("ITEMISED ESTIMATE", { font: bold });
    const rows = [
      ["Vehicle selling price", Number(invoice.quote.vehiclePrice)],
      [costs.discount?.name || "Approved commercial discount", -Number(invoice.quote.discountAmount)],
      ["Export and handling costs", Number(invoice.quote.exportCosts)],
      ["Freight", Number(invoice.quote.freight)],
      ["Marine insurance", Number(invoice.quote.insurance)],
      ["Estimated duties and taxes (subject to official verification)", Number(invoice.quote.taxesAndDuties)],
    ];
    for (const [label, amount] of rows) line(`${label}: ${money(amount as number)}`);
    y -= 3;
    line(`ESTIMATED TOTAL: ${money(Number(invoice.quote.total))}`, { size: 13, font: bold });
    y -= 8;
    line("IMPORTANT CONDITIONS", { font: bold });
    const priceSnapshot = invoice.quote.priceSnapshot as { costReferences?: string };
    if (priceSnapshot.costReferences) {
      line("Cost/tax verification references supplied by the quotation desk:", { font: bold });
      for (const reference of wrap(priceSnapshot.costReferences, 100)) line(reference, { size: 9 });
    }
    for (const condition of wrap("This pro forma invoice is not a tax invoice, payment confirmation, customs declaration, proof of stock, or guarantee of import or registration eligibility. Verify vehicle identity, supplier, costs, customs classification, tariffs, taxes, destination requirements, payment beneficiary and contract terms with qualified parties before payment.", 100)) line(condition, { size: 9 });
    if (invoice.quote.destination.toLowerCase().includes("united states") || invoice.quote.destination.toLowerCase() === "usa") {
      y -= 4;
      line("US IMPORT WARNING", { font: bold, color: rgb(0.62, 0.25, 0.12) });
      for (const condition of wrap("Do not assume US road eligibility. Verify NHTSA/DOT, EPA, CBP, tariff classification and current requirements with a qualified customs broker. Government charges are estimates only where explicitly recorded.", 100)) line(condition, { size: 9 });
    }
    const bytes = await pdf.save();
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return safeError(error);
  }
}
