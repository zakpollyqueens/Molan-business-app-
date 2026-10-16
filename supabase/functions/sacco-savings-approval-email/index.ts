import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST required" });
  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceKey) return reply(401, { error: "Authenticated request required" });

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const caller = userData.user;
  if (userError || !caller) return reply(401, { error: "Sign in again before sending the savings confirmation email" });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SACCO_EMAIL_FROM");
  if (!resendKey || !from) return reply(503, { error: "Email delivery is not configured yet. Add RESEND_API_KEY and SACCO_EMAIL_FROM to Supabase Edge Function secrets." });

  let body: { entry_id?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON body" }); }
  if (!body.entry_id) return reply(400, { error: "entry_id is required" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: entry, error: entryError } = await admin.from("sacco_savings_entries")
    .select("id,company_id,member_id,amount,transaction_date,status,entry_type,reviewed_by")
    .eq("id", body.entry_id).maybeSingle();
  if (entryError || !entry) return reply(404, { error: "Savings entry not found" });
  if (entry.status !== "confirmed" || entry.entry_type !== "deposit" || entry.reviewed_by !== caller.id)
    return reply(403, { error: "Only the chairperson who approved this confirmed savings deposit can send its confirmation" });

  const { data: role } = await admin.from("sacco_role_assignments").select("id")
    .eq("company_id", entry.company_id).eq("user_id", caller.id).eq("role", "chairperson").maybeSingle();
  if (!role) return reply(403, { error: "Only the assigned SACCO chairperson may send this confirmation" });

  const [{ data: member }, { data: company }] = await Promise.all([
    admin.from("sacco_members").select("full_name,email").eq("id", entry.member_id).eq("company_id", entry.company_id).maybeSingle(),
    admin.from("company_profiles").select("name,currency_code").eq("id", entry.company_id).maybeSingle()
  ]);
  if (!member?.email) return reply(422, { error: "This member has no email address saved in their SACCO account" });

  const currency = company?.currency_code || "UGX";
  const amount = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 2 }).format(Number(entry.amount));
  const date = String(entry.transaction_date);
  const subject = "Your SACCO savings transaction has been approved";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#142943"><h2>Savings account updated</h2><p>Hello ${esc(member.full_name)},</p><p>Your savings account has been updated successfully. A savings transaction of <strong>${esc(currency)} ${esc(amount)}</strong> has been approved and recorded on <strong>${esc(date)}</strong>.</p><p>This email confirms only the approved transaction; it does not include your account balance.</p><p>Regards,<br>${esc(company?.name || "Your SACCO Savings Group")}</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [member.email], subject, html, text: `Hello ${member.full_name},\n\nYour savings account has been updated successfully. A savings transaction of ${currency} ${amount} has been approved and recorded on ${date}.\n\nThis email confirms only the approved transaction and does not include your account balance.\n\nRegards,\n${company?.name || "Your SACCO Savings Group"}` })
  });
  if (!response.ok) {
    const details = await response.text();
    console.error("Resend delivery failed", response.status, details.slice(0, 500));
    return reply(502, { error: "Savings was approved, but the email provider could not deliver the confirmation" });
  }
  return reply(200, { sent: true, message: "Transaction confirmation email sent without disclosing account balance" });
});
