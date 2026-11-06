"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Section = "dashboard" | "vehicles" | "customers" | "suppliers" | "quotations" | "discounts" | "orders" | "payments" | "shipments" | "settings";
type Row = Record<string, unknown>;

const navigation: { id: Section; label: string }[] = [
  { id: "dashboard", label: "Overview" }, { id: "vehicles", label: "Vehicles" },
  { id: "customers", label: "Customers" }, { id: "suppliers", label: "Suppliers" },
  { id: "quotations", label: "Quotations" }, { id: "discounts", label: "Discounts" },
  { id: "orders", label: "Orders" }, { id: "shipments", label: "Shipments" },
  { id: "payments", label: "Payments" },
  { id: "settings", label: "Settings & roles" },
];
const sectionRoles: Record<Section, string[]> = {
  dashboard: ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"],
  vehicles: ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER"],
  customers: ["SUPER_ADMIN", "SALES_MANAGER"],
  suppliers: ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER"],
  quotations: ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"],
  discounts: ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER"],
  orders: ["SUPER_ADMIN", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"],
  payments: ["SUPER_ADMIN", "FINANCE_OFFICER"],
  shipments: ["SUPER_ADMIN", "LOGISTICS_MANAGER"],
  settings: ["SUPER_ADMIN", "INVENTORY_MANAGER", "SALES_MANAGER", "FINANCE_OFFICER", "LOGISTICS_MANAGER"],
};

const emptyVehicle = {
  stockReference: "", manufacturer: "", model: "", trim: "", year: String(new Date().getFullYear()),
  condition: "NEW", mileageKm: "0", batteryKwh: "", rangeKm: "", chargingSpec: "",
  driveConfiguration: "", transmission: "", exteriorColour: "", interiorColour: "", vin: "",
  description: "", bodyType: "SUV", currency: "USD", exportPrice: "", supplierId: "",
  availability: "PENDING_VERIFICATION", verified: false, imageUrls: "",
};

async function requestJson(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request could not be completed.");
  return data as Row;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function records(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => typeof row === "object" && row !== null) : [];
}

function nested(row: Row, key: string): Row {
  const value = row[key];
  return typeof value === "object" && value !== null ? value as Row : {};
}

function AdminHeader() {
  const router = useRouter();
  return <header className="admin-header"><Link href="/admin/dashboard" className="brand"><span className="brand-icon">E.V</span><span>E.V <b>CHINA</b><small>ADMIN DESK</small></span></Link><button className="back-link logout-button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/admin/login"); }}>Sign out</button></header>;
}

export function AdminWorkspace({ section, user }: { section: Section; user: { name: string; email: string; role: string } }) {
  const [data, setData] = useState<Row>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [vehicle, setVehicle] = useState({ ...emptyVehicle });
  const [editingId, setEditingId] = useState("");
  const [supplier, setSupplier] = useState({ name: "", country: "China", contactName: "", email: "", phone: "", notes: "" });
  const [quote, setQuote] = useState({ enquiryId: "", vehicleId: "", destination: "", destinationPort: "", currency: "USD", discountId: "", exportCosts: "0", freight: "0", insurance: "0", taxesAndDuties: "0", costReferences: "" });
  const [discount, setDiscount] = useState({ name: "", code: "", kind: "PERCENT", value: "", currency: "USD", startsAt: "", expiresAt: "", maxUses: "", vehicleId: "" });
  const [shipment, setShipment] = useState({ orderId: "", status: "PLANNED", shippingCompany: "", vessel: "", containerNumber: "", departurePort: "", destinationPort: "", estimatedDeparture: "", estimatedArrival: "", trackingReference: "", updateMessage: "" });
  const [payment, setPayment] = useState({ orderId: "", amount: "", currency: "USD", paymentMethod: "", paymentReference: "", notes: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      if (section === "dashboard") setData(await requestJson("/api/admin/dashboard"));
      if (section === "vehicles") setData(await requestJson("/api/admin/vehicles"));
      if (section === "customers") setData(await requestJson("/api/admin/customers"));
      if (section === "suppliers") setData(await requestJson("/api/admin/suppliers"));
      if (section === "quotations") {
        const [quoteData, discountData] = await Promise.all([requestJson("/api/admin/quotes"), requestJson("/api/admin/discounts")]);
        const inquiryData = user.role === "FINANCE_OFFICER" ? {} : await requestJson("/api/admin/enquiries");
        setData({ ...inquiryData, ...quoteData, ...discountData });
      }
      if (section === "discounts") setData(await requestJson("/api/admin/discounts"));
      if (section === "orders" || section === "shipments") setData(await requestJson("/api/admin/orders"));
      if (section === "payments") {
        const [paymentData, orderData] = await Promise.all([requestJson("/api/admin/payments"), requestJson("/api/admin/orders")]);
        setData({ ...paymentData, ...orderData });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Data could not be loaded.");
    }
  }, [section, user.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent, url: string, body: unknown, success: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson(url, "POST", body);
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request could not be completed.");
    } finally { setBusy(false); }
  }

  async function act(url: string, method: string, body: unknown, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson(url, method, body);
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request could not be completed.");
    } finally { setBusy(false); }
  }

  function editVehicle(row: Row) {
    const maker = nested(row, "manufacturer");
    const images = records(row.images).map((image) => text(image.url)).join("\n");
    setEditingId(text(row.id));
    setVehicle({
      stockReference: text(row.stockReference), manufacturer: text(maker.name), model: text(row.model), trim: text(row.trim) === "—" ? "" : text(row.trim),
      year: text(row.year), condition: text(row.condition), mileageKm: text(row.mileageKm), batteryKwh: text(row.batteryKwh) === "—" ? "" : text(row.batteryKwh),
      rangeKm: text(row.rangeKm) === "—" ? "" : text(row.rangeKm), chargingSpec: text(row.chargingSpec) === "—" ? "" : text(row.chargingSpec),
      driveConfiguration: text(row.driveConfiguration) === "—" ? "" : text(row.driveConfiguration), transmission: text(row.transmission) === "—" ? "" : text(row.transmission),
      exteriorColour: text(row.exteriorColour) === "—" ? "" : text(row.exteriorColour), interiorColour: text(row.interiorColour) === "—" ? "" : text(row.interiorColour),
      vin: text(row.vin) === "—" ? "" : text(row.vin), description: text(row.description), bodyType: text(row.bodyType), currency: text(row.currency),
      exportPrice: text(row.exportPrice), supplierId: text(row.supplierId) === "—" ? "" : text(row.supplierId),
      availability: text(row.availability), verified: Boolean(row.verifiedAt), imageUrls: images,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    const imageList = vehicle.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url) => ({ url, alt: `${vehicle.manufacturer} ${vehicle.model}` }));
    const body = {
      ...vehicle,
      year: Number(vehicle.year), mileageKm: Number(vehicle.mileageKm), exportPrice: Number(vehicle.exportPrice),
      batteryKwh: vehicle.batteryKwh ? Number(vehicle.batteryKwh) : undefined,
      rangeKm: vehicle.rangeKm ? Number(vehicle.rangeKm) : undefined,
      supplierId: vehicle.supplierId || undefined,
      images: imageList,
    };
    await act(editingId ? `/api/admin/vehicles/${editingId}` : "/api/admin/vehicles", editingId ? "PATCH" : "POST", body, editingId ? "Vehicle updated." : "Vehicle created.");
    setEditingId("");
    setVehicle({ ...emptyVehicle });
  }

  const title = navigation.find((item) => item.id === section)?.label || "Admin";
  const vehicles = records(data.vehicles);
  const suppliers = records(data.suppliers);
  const customers = records(data.customers);
  const enquiries = records(data.enquiries);
  const quotes = records(data.quotes);
  const discounts = records(data.discounts);
  const orders = records(data.orders);
  const payments = records(data.payments);
  const availableVehicles = records(section === "quotations" ? data.vehicles : data.vehicles);

  return <main className="admin-page">
    <AdminHeader/>
    <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-user"><b>{user.name}</b><small>{user.role.replaceAll("_", " ")}</small></div>{navigation.filter((item) => sectionRoles[item.id].includes(user.role)).map((item) => <Link className={section === item.id ? "active" : ""} key={item.id} href={item.id === "dashboard" ? "/admin/dashboard" : `/admin/${item.id}`}>{item.label}</Link>)}</aside>
      <section className="admin-content"><div className="admin-title-row"><div><div className="section-kicker">E.V CHINA GLOBAL · OPERATIONS</div><h1>{title}</h1></div><span className="admin-email">{user.email}</span></div>
        {error && <div className="catalog-warning" role="alert">{error}</div>}{notice && <p className="success-message" role="status">{notice}</p>}

        {section === "dashboard" && <><div className="metric-grid">{Object.entries((data.metrics || {}) as Record<string, unknown>).filter(([key]) => key !== "revenueByCurrency").map(([key, value]) => <article className="metric-card" key={key}><small>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</small><b>{text(value)}</b></article>)}</div><h2>Paid revenue (by currency)</h2><p>{records(data.metrics && (data.metrics as Row).revenueByCurrency).map((row) => `${text(row[0])} ${text(row[1])}`).join(" · ") || "No recorded paid invoices."}</p><h2>Recent audit activity</h2><div className="admin-table">{records(data.recentActivity).map((row) => <div className="admin-row" key={text(row.id)}><b>{text(row.action)}</b><span>{text(row.entityType)} · {text(row.entityId)}</span><small>{new Date(text(row.createdAt)).toLocaleString()}</small></div>)}</div></>}

        {section === "vehicles" && <><form className="admin-form" onSubmit={(event) => void saveVehicle(event)}><h2>{editingId ? "Edit vehicle" : "Add vehicle listing"}</h2><div className="admin-form-grid">
          {([
            ["stockReference", "Stock reference"], ["manufacturer", "Manufacturer"], ["model", "Model"], ["trim", "Trim"], ["year", "Model year"],
            ["mileageKm", "Mileage km"], ["batteryKwh", "Battery kWh"], ["rangeKm", "Range km"], ["chargingSpec", "Charging specification"],
            ["driveConfiguration", "Drive configuration"], ["transmission", "Transmission"], ["exteriorColour", "Exterior colour"],
            ["interiorColour", "Interior colour"], ["vin", "VIN (staff-only)"], ["bodyType", "Body type"], ["exportPrice", "Verified export price"],
          ] as const).map(([field, label]) => <label key={field}>{label}<input required={["stockReference", "manufacturer", "model", "year", "bodyType", "exportPrice"].includes(field)} value={vehicle[field]} onChange={(event) => setVehicle({ ...vehicle, [field]: event.target.value })}/></label>)}
          <label>Currency<select value={vehicle.currency} onChange={(event) => setVehicle({ ...vehicle, currency: event.target.value })}>{["USD", "EUR", "GBP", "KES", "TZS", "UGX", "RWF", "AED", "CNY"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Condition<select value={vehicle.condition} onChange={(event) => setVehicle({ ...vehicle, condition: event.target.value })}><option value="NEW">New</option><option value="USED">Used</option></select></label>
          <label>Availability<select value={vehicle.availability} onChange={(event) => setVehicle({ ...vehicle, availability: event.target.value })}>{["PENDING_VERIFICATION", "AVAILABLE", "RESERVED", "SOLD", "ARCHIVED"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Supplier<select value={vehicle.supplierId} onChange={(event) => setVehicle({ ...vehicle, supplierId: event.target.value })}><option value="">Not assigned</option>{suppliers.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label>
          <label className="admin-checkbox"><input type="checkbox" checked={vehicle.verified} onChange={(event) => setVehicle({ ...vehicle, verified: event.target.checked })}/> Supplier, stock, price and specifications verified</label>
          <label className="wide-field">Description<textarea required maxLength={4000} value={vehicle.description} onChange={(event) => setVehicle({ ...vehicle, description: event.target.value })}/></label>
          <label className="wide-field">Image URLs (one URL per line; use persistent object storage)<textarea value={vehicle.imageUrls} onChange={(event) => setVehicle({ ...vehicle, imageUrls: event.target.value })}/></label>
        </div><div className="admin-actions"><button className="button button-dark" disabled={busy}>{editingId ? "Save changes" : "Create vehicle"}</button>{editingId && <button className="button button-glass" type="button" onClick={() => { setEditingId(""); setVehicle({ ...emptyVehicle }); }}>Cancel editing</button>}</div></form><h2>Inventory ({vehicles.length})</h2><div className="admin-table">{vehicles.map((row) => <div className="admin-row" key={text(row.id)}><b>{text(nested(row, "manufacturer").name)} {text(row.model)} {text(row.year)}</b><span>{text(row.stockReference)} · {text(row.availability)} · {text(row.currency)} {text(row.exportPrice)}</span><div className="admin-actions"><button onClick={() => editVehicle(row)}>Edit</button><button onClick={() => void act(`/api/admin/vehicles/${text(row.id)}`, "DELETE", {}, "Vehicle archived.")}>Archive</button></div></div>)}</div></>}

        {section === "customers" && <div className="admin-table">{customers.map((row) => <div className="admin-row" key={text(row.id)}><b>{text(row.name)}</b><span>{text(row.email)} · {text(row.phone)} · {row.emailVerifiedAt ? "verified" : "unverified"} · {Boolean(row.isActive) ? "active" : "inactive"}</span><small>{text(nested(row, "_count").enquiries)} enquiries · {text(nested(row, "_count").quotes)} quotes · {text(nested(row, "_count").orders)} orders</small>{(user.role === "SUPER_ADMIN" || user.role === "SALES_MANAGER") && <button onClick={() => void act("/api/admin/customers", "PATCH", { id: row.id, isActive: !Boolean(row.isActive) }, Boolean(row.isActive) ? "Customer deactivated and sessions revoked." : "Customer activated.")}>{Boolean(row.isActive) ? "Deactivate" : "Activate"}</button>}</div>)}</div>}

        {section === "suppliers" && <><form className="admin-form" onSubmit={(event) => void submit(event, "/api/admin/suppliers", supplier, "Supplier created.")}><h2>Add supplier</h2><div className="admin-form-grid">{Object.entries(supplier).map(([field, value]) => <label key={field}>{field === "contactName" ? "Contact name" : field}<input value={value} required={field === "name" || field === "country"} onChange={(event) => setSupplier({ ...supplier, [field]: event.target.value })}/></label>)}</div><button className="button button-dark" disabled={busy}>Save supplier</button></form><div className="admin-table">{suppliers.map((row) => <div className="admin-row" key={text(row.id)}><b>{text(row.name)}</b><span>{text(row.country)} · {text(row.email)} · {text(row.phone)}</span><small>{text(nested(row, "_count").vehicles)} vehicles · {Boolean(row.active) ? "active" : "inactive"}</small><button onClick={() => void act(`/api/admin/suppliers/${text(row.id)}`, "PATCH", { active: !Boolean(row.active) }, Boolean(row.active) ? "Supplier deactivated." : "Supplier activated.")}>{Boolean(row.active) ? "Deactivate" : "Activate"}</button></div>)}</div></>}

        {section === "quotations" && <>{user.role !== "FINANCE_OFFICER" && <><h2>Incoming enquiries</h2><div className="admin-table">{enquiries.map((row) => {
          const nextStatuses = row.status === "RECEIVED" ? ["SOURCING", "CLOSED"] : row.status === "SOURCING" || row.status === "QUOTED" ? ["CLOSED"] : [];
          return <div className="admin-row" key={text(row.id)}><b>{text(row.name)} · {text(row.email)}</b><span>{text(row.vehicleBrief)} · {text(row.country)} · {text(row.cityOrPort)}</span><small>{text(row.budget)} · {text(row.quantity)} requested · {text(row.status)}</small>{nextStatuses.length > 0 && <label>Update status<select value="" disabled={busy} onChange={(event) => void act("/api/admin/enquiries", "PATCH", { id: row.id, status: event.target.value }, `Enquiry moved to ${event.target.value}.`)}><option value="">Choose status</option>{nextStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>}</div>;
        })}</div><form className="admin-form" onSubmit={(event) => void submit(event, "/api/admin/quotes", {
          ...quote, exportCosts: Number(quote.exportCosts), freight: Number(quote.freight), insurance: Number(quote.insurance), taxesAndDuties: Number(quote.taxesAndDuties),
          enquiryId: quote.enquiryId || undefined, discountId: quote.discountId || undefined,
        }, "Quotation created from verified vehicle price snapshot.")}><h2>Prepare staff-verified quotation</h2><div className="admin-form-grid">
          <label>Customer enquiry<select required value={quote.enquiryId} onChange={(event) => { const selected = enquiries.find((row) => text(row.id) === event.target.value); setQuote({ ...quote, enquiryId: event.target.value, destination: text(selected?.country) === "—" ? "" : text(selected?.country), destinationPort: text(selected?.cityOrPort) === "—" ? "" : text(selected?.cityOrPort), vehicleId: text(selected?.vehicleId) === "—" ? "" : text(selected?.vehicleId) }); }}><option value="">Select enquiry</option>{enquiries.filter((row) => row.status !== "CLOSED").map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)} · {text(row.vehicleBrief)} · {text(row.country)}</option>)}</select></label>
          <label>Verified available vehicle<select required value={quote.vehicleId} onChange={(event) => { const selected = availableVehicles.find((row) => text(row.id) === event.target.value); setQuote({ ...quote, vehicleId: event.target.value, currency: text(selected?.currency) === "—" ? "USD" : text(selected?.currency) }); }}><option value="">Select vehicle</option>{availableVehicles.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(nested(row, "manufacturer").name)} {text(row.model)} {text(row.year)} · {text(row.currency)} {text(row.exportPrice)}</option>)}</select></label>
          <label>Destination country<input required value={quote.destination} onChange={(event) => setQuote({ ...quote, destination: event.target.value })}/></label><label>Port / city<input value={quote.destinationPort} onChange={(event) => setQuote({ ...quote, destinationPort: event.target.value })}/></label>
          <label>Commercial discount<select value={quote.discountId} onChange={(event) => setQuote({ ...quote, discountId: event.target.value })}><option value="">No discount</option>{discounts.filter((row) => row.active).map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.name)} · {text(row.kind)} {text(row.value)}</option>)}</select></label>
          {(["exportCosts", "freight", "insurance", "taxesAndDuties"] as const).map((field) => <label key={field}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input type="number" min="0" step="0.01" value={quote[field]} onChange={(event) => setQuote({ ...quote, [field]: event.target.value })}/></label>)}
          <label className="wide-field">Cost, freight and tax verification sources/references<textarea required value={quote.costReferences} onChange={(event) => setQuote({ ...quote, costReferences: event.target.value })} placeholder="Record provider quotes, official tax sources, tariff classification, verification date and any caveats."/></label>
        </div><p className="form-hint">Only the server-set vehicle selling price and currently approved discounts are used. Record official sources and verification dates for destination duties and taxes; the system does not calculate them.</p><button className="button button-dark" disabled={busy}>Create quotation draft</button></form></>}{<h2>Quotations and invoices</h2>}<div className="admin-table">{quotes.map((row) => <div className="admin-row" key={text(row.id)}><b>{text(row.number)} · {text(row.customerName)}</b><span>{text(row.destination)} · {text(row.currency)} {text(row.total)} · {text(row.status)}</span>{!Boolean(row.invoice) && <button onClick={() => void act(`/api/admin/quotes/${text(row.id)}/invoice`, "POST", {}, "Pro forma invoice issued.")}>Issue pro forma invoice</button>}{Boolean(nested(row, "invoice").id) && <><span>Invoice {text(nested(row, "invoice").number)} · {text(nested(row, "invoice").status)}</span><button onClick={() => void act(`/api/admin/invoices/${text(nested(row, "invoice").id)}/email`, "POST", {}, "Invoice emailed to customer.")}>Email invoice</button></>}</div>)}</div></>}

        {section === "discounts" && (
          <>
            {user.role !== "FINANCE_OFFICER" && (
              <form className="admin-form" onSubmit={(event) => void submit(event, "/api/admin/discounts", {
                ...discount,
                value: Number(discount.value),
                currency: discount.currency || undefined,
                startsAt: discount.startsAt ? new Date(discount.startsAt).toISOString() : undefined,
                expiresAt: discount.expiresAt ? new Date(discount.expiresAt).toISOString() : undefined,
                maxUses: discount.maxUses ? Number(discount.maxUses) : undefined,
                vehicleId: discount.vehicleId || undefined,
              }, "Discount campaign created. It must be approved before use.")}>
                <h2>Create a commercial discount</h2>
                <div className="admin-form-grid">
                  <label>Name<input required value={discount.name} onChange={(event) => setDiscount({ ...discount, name: event.target.value })}/></label>
                  <label>Coupon code<input value={discount.code} onChange={(event) => setDiscount({ ...discount, code: event.target.value })}/></label>
                  <label>Discount type<select value={discount.kind} onChange={(event) => setDiscount({ ...discount, kind: event.target.value })}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></select></label>
                  <label>Value<input type="number" min="0" step="0.01" required value={discount.value} onChange={(event) => setDiscount({ ...discount, value: event.target.value })}/></label>
                  <label>Currency<input value={discount.currency} onChange={(event) => setDiscount({ ...discount, currency: event.target.value })}/></label>
                  <label>Maximum uses<input type="number" min="1" value={discount.maxUses} onChange={(event) => setDiscount({ ...discount, maxUses: event.target.value })}/></label>
                </div>
                <button className="button button-dark" disabled={busy}>Save campaign</button>
              </form>
            )}
            <div className="admin-table">{discounts.map((row) => (
              <div className="admin-row" key={text(row.id)}>
                <b>{text(row.name)} · {text(row.kind)} {text(row.value)}</b>
                <span>{text(row.code)} · {row.active ? "approved" : "pending approval"}</span>
                {user.role === "SUPER_ADMIN" && (
                  <button onClick={() => void act("/api/admin/discounts", "PATCH", { id: row.id, active: !row.active }, row.active ? "Discount approval revoked." : "Discount approved.")}>
                    {row.active ? "Revoke" : "Approve"}
                  </button>
                )}
              </div>
            ))}</div>
          </>
        )}

        {(section === "orders" || section === "shipments") && <><h2>{section === "orders" ? "Order lifecycle" : "Shipment records"}</h2><div className="admin-table">{orders.map((row) => {
          const current = text(row.status);
          const next = ({ AWAITING_PAYMENT: "PAYMENT_VERIFIED", PAYMENT_VERIFIED: "VEHICLE_INSPECTION", VEHICLE_INSPECTION: "EXPORT_DOCUMENTATION", EXPORT_DOCUMENTATION: "READY_FOR_SHIPMENT", READY_FOR_SHIPMENT: "SHIPPED", SHIPPED: "IN_TRANSIT", IN_TRANSIT: "ARRIVED_AT_DESTINATION", ARRIVED_AT_DESTINATION: "COMPLETED" } as Record<string, string>)[current];
          const ship = nested(row, "shipment");
          return <div className="admin-row" key={text(row.id)}><b>{text(row.number)} · {text(nested(row, "customer").name)}</b><span>{current.replaceAll("_", " ")} · {text(row.destination)}</span>{ship.id ? <small>Shipment: {text(ship.status)} · {text(ship.vessel)} · {text(ship.trackingReference)}</small> : <small>No logistics provider/tracking registered.</small>}
            {section === "orders" && next && <button onClick={() => { if (next !== "CANCELLED" || window.confirm("Cancel this order? Any issued pro forma invoice will be voided.")) void act(`/api/admin/orders/${text(row.id)}`, "PATCH", { status: next }, next === "CANCELLED" ? "Order cancelled and any unpaid invoice voided." : `Order advanced to ${next}.`); }} disabled={(["VEHICLE_INSPECTION", "EXPORT_DOCUMENTATION", "READY_FOR_SHIPMENT", "SHIPPED", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "COMPLETED"].includes(next) && user.role !== "LOGISTICS_MANAGER" && user.role !== "SUPER_ADMIN")}>{next === "CANCELLED" ? "Cancel order" : `Advance to ${next.replaceAll("_", " ")}`}</button>}
            {section === "shipments" && <button onClick={() => setShipment({ ...shipment, orderId: text(row.id), destinationPort: text(ship.destinationPort) === "—" ? "" : text(ship.destinationPort), status: text(ship.status) === "—" ? "PLANNED" : text(ship.status) })}>Update shipment</button>}
          </div>;
        })}</div>
        {section === "shipments" && <form className="admin-form" onSubmit={(event) => void submit(event, `/api/admin/orders/${shipment.orderId}/shipment`, {
          ...shipment,
          estimatedDeparture: shipment.estimatedDeparture || undefined,
          estimatedArrival: shipment.estimatedArrival || undefined,
        }, "Shipment update recorded.")}><h2>Record shipment information</h2><div className="admin-form-grid">
          <label>Order<select required value={shipment.orderId} onChange={(event) => setShipment({ ...shipment, orderId: event.target.value })}><option value="">Select order</option>{orders.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.number)} · {text(row.destination)}</option>)}</select></label>
          <label>Status<select value={shipment.status} onChange={(event) => setShipment({ ...shipment, status: event.target.value })}>{["PLANNED", "BOOKED", "DEPARTED", "IN_TRANSIT", "ARRIVED", "DELIVERED", "DELAYED"].map((status) => <option key={status}>{status}</option>)}</select></label>
          {(["shippingCompany", "vessel", "containerNumber", "departurePort", "destinationPort", "trackingReference"] as const).map((field) => <label key={field}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input value={shipment[field]} onChange={(event) => setShipment({ ...shipment, [field]: event.target.value })}/></label>)}
          <label>Estimated departure<input type="datetime-local" value={shipment.estimatedDeparture} onChange={(event) => setShipment({ ...shipment, estimatedDeparture: event.target.value ? new Date(event.target.value).toISOString() : "" })}/></label><label>Estimated arrival<input type="datetime-local" value={shipment.estimatedArrival} onChange={(event) => setShipment({ ...shipment, estimatedArrival: event.target.value ? new Date(event.target.value).toISOString() : "" })}/></label>
          <label className="wide-field">Status update for customer<input required value={shipment.updateMessage} onChange={(event) => setShipment({ ...shipment, updateMessage: event.target.value })}/></label>
        </div><button className="button button-dark" disabled={busy || !shipment.orderId}>Save shipment update</button></form>}
        </>}

        {section === "payments" && <><form className="admin-form" onSubmit={(event) => void submit(event, "/api/admin/payments", { ...payment, amount: Number(payment.amount) }, "External payment recorded as pending verification.")}><h2>Record an external payment for verification</h2><div className="admin-form-grid">
          <label>Order<select required value={payment.orderId} onChange={(event) => { const selected = orders.find((row) => text(row.id) === event.target.value); setPayment({ ...payment, orderId: event.target.value, currency: text(nested(selected || {}, "quote").currency) === "—" ? "USD" : text(nested(selected || {}, "quote").currency) }); }}><option value="">Select order</option>{orders.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.number)} · {text(nested(row, "customer").name)} · {text(row.destination)}</option>)}</select></label>
          <label>Amount<input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></label>
          <label>Currency<input required maxLength={3} value={payment.currency} onChange={(event) => setPayment({ ...payment, currency: event.target.value.toUpperCase() })}/></label>
          <label>External payment method<input required value={payment.paymentMethod} onChange={(event) => setPayment({ ...payment, paymentMethod: event.target.value })} placeholder="Bank transfer, provider reference…"/></label>
          <label>Provider/bank reference<input required value={payment.paymentReference} onChange={(event) => setPayment({ ...payment, paymentReference: event.target.value })}/></label>
          <label>Notes<input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></label>
        </div><p className="form-hint">Do not enter card numbers or payment credentials. This records a customer payment made outside the platform; it does not initiate or confirm a payment.</p><button className="button button-dark" disabled={busy}>Record pending payment</button></form><h2>Payment records</h2><div className="admin-table">{payments.map((row) => <div className="admin-row" key={text(row.id)}><b>{text(nested(row, "order").number)} · {text(row.currency)} {text(row.amount)}</b><span>{text(row.paymentMethod)} · reference {text(row.paymentReference)} · {text(row.status)}</span><small>{text(nested(nested(row, "order"), "customer").name)} · {text(nested(row, "verifiedBy").name) === "—" ? "not verified" : `verified by ${text(nested(row, "verifiedBy").name)}`}</small>{row.status === "PENDING" && <div className="admin-actions"><button onClick={() => void act("/api/admin/payments", "PATCH", { id: row.id, status: "VERIFIED" }, "Payment verified.")}>Verify</button><button onClick={() => void act("/api/admin/payments", "PATCH", { id: row.id, status: "FAILED" }, "Payment marked failed.")}>Mark failed</button></div>}</div>)}</div></>}

        {section === "settings" && <><h2>Role permissions</h2><div className="admin-table">{[
          ["SUPER_ADMIN", "Full access, role overrides, approvals, inventory, sales, finance and logistics."],
          ["INVENTORY_MANAGER", "Create/edit/archive vehicle listings and manage supplier records."],
          ["SALES_MANAGER", "View customers/enquiries; prepare quotations; create discount campaigns pending approval."],
          ["FINANCE_OFFICER", "View quotations, issue invoices, record verified payments and review revenue."],
          ["LOGISTICS_MANAGER", "Manage shipment details, tracking references and shipping-stage order status."],
          ["CUSTOMER", "Access only own profile, saved vehicles, enquiries, quotations, invoices, orders and shipment updates."],
        ].map(([role, access]) => <div className="admin-row" key={role}><b>{role.replaceAll("_", " ")}</b><span>{access}</span></div>)}</div><h2>Session & audit</h2><p>Staff sessions use an HTTP-only, same-site cookie with a seven-day expiry. Passwords are bcrypt-hashed. Admin bootstrap does not create public default credentials. Business-changing actions are recorded in the audit log.</p><p className="form-hint">Staff accounts and roles are created through the restricted provisioning CLI. Never grant a role through a customer-facing registration form.</p></>}
      </section>
    </div>
  </main>;
}
