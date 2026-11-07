import { AuthForm } from "@/components/auth-form";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  return <AuthForm mode="admin" alreadyAuthenticated={Boolean(user && isStaff(user.role))}/>;
}
