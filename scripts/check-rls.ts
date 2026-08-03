import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
const envPath = path.resolve(process.cwd(), ".env");
const c = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
c.split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/); if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, ""); });
const url = env["VITE_SUPABASE_URL"];
const key = env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"];
const supabase = createClient(url, key);

async function main() {
  // Cek RLS enabled
  const { data: rls, error: e0 } = await supabase.rpc("exec_sql", {
    query: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('stok_movement','penjualan','permohonan_stok','produksi','outlets','bahan_baku','jurnal') ORDER BY relname`
  });
  console.log("RLS STATUS:", e0 ? `ERR ${e0.message}` : JSON.stringify(rls));

  const { data: pol, error: e1 } = await supabase.rpc("exec_sql", {
    query: `SELECT tablename, policyname, cmd, roles FROM pg_policies ORDER BY tablename, policyname`
  });
  console.log("\nPOLICIES:", e1 ? `ERR ${e1.message}` : JSON.stringify(pol));
}
main().catch((e) => { console.error(e); process.exit(1); });
