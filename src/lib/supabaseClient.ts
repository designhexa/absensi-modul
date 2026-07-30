import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase environment variables! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or hosting provider settings."
  );
}

// Use placeholder credentials if actual variables are missing to prevent initialization crash
const url = supabaseUrl || "https://mrydrongthbximtflbps.supabase.co";
const key = supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeWRyb25ndGhieGltdGZsYnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTg0ODEsImV4cCI6MjA5NzM3NDQ4MX0.fD09-tBBXi9o37AOB8sgMUhrDG7sSNmyeriZq1VG1Cg";

export const supabase = createClient(url, key);
