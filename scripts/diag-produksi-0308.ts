import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
const envPath = path.resolve(process.cwd(), ".env");
const c = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
c.split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/); if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, ""); });
const supabase = createClient(env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"]);
async function main() {
  const { data: prod, error } = await supabase.from("produksi").select("*").eq("tanggal", "2026-08-03").order("produk_id");
  console.log("PRODUKSI 08-03:", error ? `ERR ${error.message}` : "");
  prod?.forEach((p: any) => console.log(`  ${p.produk_id} rencana=${p.qty_rencana} realisasi=${p.qty_realisasi}`));
  const { data: pen, error: e2 } = await supabase.from("penjualan").select("outlet_id, produk_id, qty, sisa_gram, variant").eq("tanggal", "2026-08-03").eq("produk_id", "p-abon");
  console.log("\nPENJUALAN ABON 08-03:", e2 ? `ERR ${e2.message}` : "");
  pen?.forEach((p: any) => console.log(`  ${p.outlet_id} qty=${p.qty} sisa=${p.sisa_gram} v=${p.variant}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
