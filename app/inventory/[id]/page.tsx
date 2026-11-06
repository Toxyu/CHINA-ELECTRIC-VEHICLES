"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Heart, Zap } from "lucide-react";

type Vehicle = {
  id: string;
  stockReference: string;
  model: string;
  trim: string | null;
  year: number;
  condition: string;
  mileageKm: number;
  batteryKwh: string | null;
  rangeKm: number | null;
  chargingSpec: string | null;
  driveConfiguration: string | null;
  transmission: string | null;
  exteriorColour: string | null;
  interiorColour: string | null;
  description: string;
  bodyType: string;
  currency: string;
  exportPrice: string;
  manufacturer: { name: string };
  images: { url: string; alt: string }[];
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ name: "", email: "", country: "", port: "", budget: "", notes: "" });

  useEffect(() => {
    fetch(`/api/vehicles/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Vehicle could not be loaded.");
        setVehicle(data.vehicle);
        setImage(data.vehicle.images[0]?.url || "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Vehicle could not be loaded."));
  }, [id]);

  async function saveVehicle() {
    try {
      const response = await fetch("/api/saved-vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in to save vehicles.");
      setStatus(data.saved ? "Vehicle added to your saved list." : "Vehicle removed from your saved list.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not save this vehicle."); }
  }

  async function submitEnquiry(event: FormEvent) {
    event.preventDefault();
    if (!vehicle) return;
    setStatus("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, country: form.country, cityOrPort: form.port, budget: form.budget, notes: form.notes, vehicleId: vehicle.id, vehicleBrief: `${vehicle.manufacturer.name} ${vehicle.model} ${vehicle.trim || ""} ${vehicle.year}`.trim(), quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enquiry could not be submitted.");
      setStatus(data.message);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Enquiry could not be submitted."); }
  }

  const money = vehicle ? new Intl.NumberFormat(undefined, { style: "currency", currency: vehicle.currency, maximumFractionDigits: 0 }).format(Number(vehicle.exportPrice)) : "";

  return <main className="catalog-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon"><Zap/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/inventory" className="back-link"><ArrowLeft size={16}/> Inventory</Link></header>
    {error && <section className="catalog-body"><div className="catalog-warning" role="alert">{error}<p><Link href="/inventory">Return to marketplace</Link></p></div></section>}
    {!vehicle && !error && <section className="catalog-body">Loading vehicle details…</section>}
    {vehicle && <><section className="detail-layout">
      <div><div className="detail-main-image" style={{ backgroundImage: image ? `url("${image}")` : undefined }}/><div className="detail-thumbnails">{vehicle.images.map((item) => <button key={item.url} aria-label={`View ${item.alt}`} onClick={() => setImage(item.url)} style={{ backgroundImage: `url("${item.url}")` }}/>)}</div></div>
      <div className="detail-overview"><div className="section-kicker">VERIFIED LISTING · {vehicle.stockReference}</div><h1>{vehicle.manufacturer.name}<br/><em>{vehicle.model}</em></h1><p>{vehicle.year} · {vehicle.condition === "NEW" ? "New" : "Used"} · {vehicle.bodyType}</p><div className="vehicle-price detail-price">{money}</div><p className="detail-copy">{vehicle.description}</p><div className="detail-actions"><button className="button button-dark" onClick={() => void saveVehicle()}><Heart size={16}/> Save vehicle</button><a className="button button-lime" href="#request-quote">Request a verified quote <ArrowUpRight size={16}/></a></div><p className="form-hint" role="status">{status}</p><p className="detail-disclaimer">Availability and price can change; supplier, documents, exact specification and destination eligibility must be reconfirmed before sale. Duties and local taxes are not included unless an issued quotation says otherwise.</p></div>
    </section>
    <section className="detail-content"><div><h2>Vehicle specifications</h2><dl className="spec-table">
      <dt>Model year</dt><dd>{vehicle.year}</dd><dt>Condition</dt><dd>{vehicle.condition}</dd><dt>Mileage</dt><dd>{vehicle.mileageKm.toLocaleString()} km</dd><dt>Battery</dt><dd>{vehicle.batteryKwh ? `${vehicle.batteryKwh} kWh` : "Not verified"}</dd><dt>Driving range</dt><dd>{vehicle.rangeKm ? `${vehicle.rangeKm} km` : "Not verified"}</dd><dt>Charging</dt><dd>{vehicle.chargingSpec || "Not verified"}</dd><dt>Drive configuration</dt><dd>{vehicle.driveConfiguration || "Not verified"}</dd><dt>Transmission</dt><dd>{vehicle.transmission || "Not verified"}</dd><dt>Exterior colour</dt><dd>{vehicle.exteriorColour || "Not verified"}</dd><dt>Interior colour</dt><dd>{vehicle.interiorColour || "Not verified"}</dd>
    </dl></div><form id="request-quote" className="enquiry-form" onSubmit={(event) => void submitEnquiry(event)}><h2>Request a quotation</h2><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label>Destination country<input required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} placeholder="e.g. Kenya"/></label><label>Destination city or port<input value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })}/></label><label>Budget (amount and currency)<input value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })}/></label><label>Requirements<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></label><button className="button button-dark form-submit">Send quotation enquiry</button><small className="form-hint" role="status">{status}</small></form></section></>}
  </main>;
}
