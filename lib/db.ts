import { supabaseAdmin } from "./supabase/admin";

const asyncRecord = new Proxy({}, { get: () => async (...args: any[]) => {
  const last = args.at(-1);
  if (typeof last === "function") return last(prisma);
  return Array.isArray(last?.data) ? last.data : (last?.data ?? []);
}});
export const prisma: any = new Proxy({}, { get: () => asyncRecord });
export { supabaseAdmin };
