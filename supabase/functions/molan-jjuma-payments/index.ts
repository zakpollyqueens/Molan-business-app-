import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const JJUMA_PUBLIC_KEY = Deno.env.get("JJUMA_PUBLIC_API_KEY") ?? "";
const JJUMA_SECRET_KEY = Deno.env.get("JJUMA_SECRET_API_KEY") ?? "";
const JJUMA_WEBHOOK_SECRET = Deno.env.get("JJUMA_WEBHOOK_SECRET") ?? "";
const API_BASE = "https://api.jjuma.com/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createCheckout(req: Request) {
  if (!JJUMA_PUBLIC_KEY) return json({ error: "Payment provider is not configured yet." }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in is required." }, 401);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Your session is invalid or expired." }, 401);

  const body = await req.json().catch(() => null);
  const companyId = typeof body?.company_id === "string" ? body.company_id : "";
  const planCode = typeof body?.plan_code === "string" ? body.plan_code.toLowerCase() : "";
  const marketCode = typeof body?.market_code === "string" ? body.market_code.toUpperCase() : "";
  if (!companyId || !["gold", "silver", "premium"].includes(planCode) || !marketCode) {
    return json({ error: "company_id, plan_code, and market_code are required." }, 400);
  }

  const { data: member, error: memberError } = await admin
    .from("company_members").select("role,status")
    .eq("company_id", companyId).eq("user_id", userData.user.id).eq("status", "active").maybeSingle();
  if (memberError || !member || !["owner", "admin"].includes(String(member.role).toLowerCase())) {
    return json({ error: "Only an active company owner or administrator can purchase an upgrade." }, 403);
  }

  const { data: plan, error: planError } = await admin
    .from("subscription_plan_catalog")
    .select("plan_code,display_name,duration_months,is_active")
    .eq("plan_code", planCode).eq("is_active", true).maybeSingle();
  if (planError || !plan) return json({ error: "That subscription plan is not available." }, 400);

  const { data: price, error: priceError } = await admin
    .from("subscription_plan_prices")
    .select("market_code,currency_code,package_amount,price_status,checkout_enabled")
    .eq("plan_code", planCode).eq("market_code", marketCode)
    .eq("price_status", "approved").eq("checkout_enabled", true).maybeSingle();
  if (priceError || !price || !price.currency_code || !price.package_amount || Number(price.package_amount) <= 0) {
    return json({ error: "Checkout is not enabled for this market and plan. Please contact support." }, 409);
  }

  const { data: event, error: eventError } = await admin
    .from("subscription_payment_events")
    .insert({
      company_id: companyId,
      plan_code: planCode,
      provider: "jjuma",
      amount: Number(price.package_amount),
      currency_code: String(price.currency_code).toUpperCase(),
      status: "pending",
      provider_metadata: { market_code: marketCode, customer_user_id: userData.user.id },
    })
    .select("id").single();
  if (eventError || !event) return json({ error: "Could not create the payment record." }, 500);

  const webhookUrl = `${SUPABASE_URL}/functions/v1/molan-jjuma-payments?action=webhook`;
  const payload = {
    amount: Number(price.package_amount),
    currency: String(price.currency_code).toUpperCase(),
    description: `Molan Business ${plan.display_name} plan (${plan.duration_months} month${plan.duration_months === 1 ? "" : "s"})`,
    customer_name: userData.user.user_metadata?.full_name || userData.user.email || "Molan Business customer",
    customer_email: userData.user.email,
    external_order_id: event.id,
    idempotency_key: event.id,
    metadata: {
      product: "molan_business_subscription",
      company_id: companyId,
      plan_code: planCode,
      market_code: marketCode,
      payment_event_id: event.id,
      customer_user_id: userData.user.id,
    },
  };

  let providerResponse: any;
  try {
    const response = await fetch(`${API_BASE}/payments/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JJUMA_PUBLIC_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    providerResponse = await response.json();
    if (!response.ok || providerResponse?.success !== true || !providerResponse?.data?.transaction_id ||
        typeof providerResponse?.data?.payment_url !== "string") {
      await admin.from("subscription_payment_events").update({
        status: "failed",
        provider_metadata: { market_code: marketCode, provider_error: "Payment creation was rejected." },
      }).eq("id", event.id);
      return json({ error: "Jjuma Pay could not create checkout. No upgrade has been activated." }, 502);
    }
    const checkoutUrl = new URL(providerResponse.data.payment_url);
    if (checkoutUrl.protocol !== "https:" || !["pay.jjuma.com"].includes(checkoutUrl.hostname)) {
      await admin.from("subscription_payment_events").update({ status: "failed" }).eq("id", event.id);
      return json({ error: "The payment provider returned an untrusted checkout URL." }, 502);
    }
    await admin.from("subscription_payment_events").update({
      provider_reference: String(providerResponse.data.transaction_id),
      provider_metadata: {
        market_code: marketCode,
        transaction_id: String(providerResponse.data.transaction_id),
        provider_reference: providerResponse.data.reference ?? null,
        checkout_created: true,
      },
    }).eq("id", event.id);
    return json({
      success: true,
      payment_url: checkoutUrl.toString(),
      transaction_id: providerResponse.data.transaction_id,
      amount: Number(price.package_amount),
      currency: String(price.currency_code).toUpperCase(),
      plan: plan.display_name,
      duration_months: plan.duration_months,
      status: "pending",
      message: "Complete checkout. Your subscription activates only after server-side payment verification.",
    });
  } catch (_error) {
    await admin.from("subscription_payment_events").update({ status: "failed" }).eq("id", event.id);
    return json({ error: "Could not contact Jjuma Pay. No upgrade has been activated." }, 502);
  }
}

async function handleWebhook(req: Request) {
  if (!JJUMA_WEBHOOK_SECRET || !JJUMA_SECRET_KEY) {
    return json({ error: "Webhook verification is not configured." }, 503);
  }
  const signature = (req.headers.get("X-Jjuma-Signature") ?? "").trim().replace(/^sha256=/i, "");
  const timestamp = (req.headers.get("X-Jjuma-Timestamp") ?? "").trim();
  const rawBody = await req.text();
  if (!signature || !timestamp || !rawBody) return json({ error: "Missing signed webhook data." }, 400);

  const parsedTimestamp = Number(timestamp);
  const timeMs = Number.isFinite(parsedTimestamp)
    ? (parsedTimestamp < 1e12 ? parsedTimestamp * 1000 : parsedTimestamp)
    : Date.parse(timestamp);
  if (!Number.isFinite(timeMs) || Math.abs(Date.now() - timeMs) > 5 * 60 * 1000) {
    return json({ error: "Webhook timestamp is invalid or expired." }, 401);
  }
  const expected = await hmacHex(JJUMA_WEBHOOK_SECRET, `${timestamp}.${rawBody}`);
  if (!safeEqual(expected.toLowerCase(), signature.toLowerCase())) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  const eventPayload = JSON.parse(rawBody);
  const eventName = String(eventPayload?.event ?? req.headers.get("X-Jjuma-Event") ?? "");
  const data = eventPayload?.data ?? {};
  const transactionId = String(data.transaction_id ?? eventPayload.transaction_id ?? "");
  if (!transactionId) return json({ error: "Webhook has no transaction ID." }, 400);
  if (eventName !== "payment.completed") return json({ success: true, ignored: true });

  const { data: paymentEvent, error: eventLookupError } = await admin
    .from("subscription_payment_events").select("*")
    .eq("provider", "jjuma").eq("provider_reference", transactionId).maybeSingle();
  if (eventLookupError) return json({ error: "Could not look up payment record." }, 500);
  if (!paymentEvent) return json({ error: "No matching payment record." }, 404);
  if (paymentEvent.status === "verified") return json({ success: true, already_processed: true });

  let verification: any;
  try {
    const verifyResponse = await fetch(`${API_BASE}/payments/verify/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${JJUMA_SECRET_KEY}`, Accept: "application/json" },
    });
    verification = await verifyResponse.json();
    if (!verifyResponse.ok || verification?.status !== "success" ||
        String(verification?.data?.status ?? "").toLowerCase() !== "successful") {
      return json({ error: "Jjuma Pay has not verified this payment as successful." }, 409);
    }
  } catch (_error) {
    return json({ error: "Could not verify payment with Jjuma Pay." }, 502);
  }

  const verifiedData = verification.data;
  const amount = Number(verifiedData.amount ?? data.amount);
  const currency = String(verifiedData.currency ?? data.currency ?? "").toUpperCase();
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(Number(paymentEvent.amount) * 100) ||
      currency !== String(paymentEvent.currency_code).toUpperCase()) {
    return json({ error: "Verified amount or currency does not match the pending subscription." }, 409);
  }

  const { error: markError } = await admin.from("subscription_payment_events").update({
    status: "verified",
    verified_at: new Date().toISOString(),
    paid_at: verifiedData.paid_at ?? new Date().toISOString(),
    provider_metadata: {
      ...(paymentEvent.provider_metadata ?? {}),
      webhook_event: eventName,
      delivery_id: req.headers.get("X-Jjuma-Delivery-Id"),
      verified_transaction_id: transactionId,
      verified_amount: amount,
      verified_currency: currency,
    },
  }).eq("id", paymentEvent.id).eq("status", "pending");
  if (markError) return json({ error: "Could not record verified payment." }, 500);

  const { error: activationError } = await admin.rpc("activate_verified_company_subscription", {
    p_company_id: paymentEvent.company_id,
    p_payment_event_id: paymentEvent.id,
  });
  if (activationError) {
    await admin.from("subscription_payment_events").update({ status: "pending", verified_at: null, paid_at: null })
      .eq("id", paymentEvent.id).eq("status", "verified");
    return json({ error: "Payment verified but subscription activation needs retry." }, 500);
  }
  return json({ success: true, activated: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("action") === "webhook") return await handleWebhook(req);
    return await createCheckout(req);
  } catch (_error) {
    return json({ error: "Unexpected payment processing error." }, 500);
  }
});
