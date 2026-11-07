import Link from "next/link";
import { AdminWorkspace } from "@/components/admin-workspace";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getCurrentUser();

  if (!user || !isStaff(user.role)) {
    return <main className="auth-page"><section className="auth-card"><div className="section-kicker">E.V CHINA GLOBAL ADMINISTRATION</div><h1>Please sign in</h1><p>You need an administrator session to access the dashboard.</p><Link className="button button-dark" href="/admin/login">Sign in to admin</Link></section></main>;
  }

  return <AdminWorkspace section="dashboard" user={user}/>;
}
