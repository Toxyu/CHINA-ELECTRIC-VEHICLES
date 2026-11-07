import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminWorkspace } from "@/components/admin-workspace";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sections = ["dashboard", "vehicles", "customers", "suppliers", "quotations", "discounts", "orders", "payments", "shipments", "settings"] as const;
type AdminSection = (typeof sections)[number];
const sectionRoles: Record<AdminSection, string[]> = {
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

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as AdminSection)) notFound();
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return <main className="auth-page"><section className="auth-card"><div className="section-kicker">E.V CHINA GLOBAL ADMINISTRATION</div><h1>Please sign in</h1><p>You need an administrator session to access this section.</p><Link className="button button-dark" href="/admin/login">Sign in to admin</Link></section></main>;
  }
  if (!sectionRoles[section as AdminSection].includes(user.role)) {
    return <main className="auth-page"><section className="auth-card"><div className="section-kicker">E.V CHINA GLOBAL ADMINISTRATION</div><h1>Access unavailable</h1><p>Your administrator role does not include this section.</p><Link className="button button-dark" href="/admin">Return to dashboard</Link></section></main>;
  }
  return <AdminWorkspace section={section as AdminSection} user={user}/>;
}
