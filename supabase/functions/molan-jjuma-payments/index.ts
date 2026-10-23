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

async function triggerWebsiteBuilder(action: "build" | "publish", requestId: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/website-service-builder`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action, request_id: requestId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) {
      console.error("Website builder follow-up needs retry:", action, data?.error || response.status);
      return { success: false, status: data?.status || "pending", error: data?.error || "Website processing is still pending." };
    }
    return { success: true, status: data.status || "complete", url: data.url };
  } catch (error) {
    console.error("Website builder follow-up failed:", action, error);
    return { success: false, status: "pending", error: "Website processing is still pending." };
  }
}
async function markWebsiteCheckoutFailed(paymentId: string, requestId: string, message: string) {
  await admin.from("website_service_checkout_payments").update({
    status: "failed",
    provider_metadata: { checkout_created: false, provider_error: message },
  }).eq("id", paymentId).eq("status", "pending");

  const { data: request } = await admin.from("website_service_requests")
    .select("status,payment_status").eq("id", requestId).maybeSingle();
  const { data: payment } = await admin.from("website_service_checkout_payments")
    .select("provider_metadata").eq("id", paymentId).maybeSingle();
  const isBalanceCheckout = payment?.provider_metadata?.payment_stage === "balance";
  const patch: Record<string, unknown> = { payment_status: isBalanceCheckout ? "partially_paid" : "failed" };
  if (!isBalanceCheckout && request?.status === "awaiting_payment") patch.status = "requested";
  await admin.from("website_service_requests").update(patch).eq("id", requestId);
}

async function createWebsiteServiceCheckout(authenticatedUser: any, body: any) {
  const companyId = typeof body?.company_id === "string" ? body.company_id : "";
  const requestId = typeof body?.website_request_id === "string" ? body.website_request_id : "";
  const paymentStage = body?.payment_stage === "balance" ? "balance" : "deposit";
  if (!companyId || !requestId) return json({ error: "company_id and website_request_id are required." }, 400);

  const { data: member, error: memberError } = await admin
    .from("company_members").select("role,status")
    .eq("company_id", companyId).eq("user_id", authenticatedUser.id)
    .eq("status", "active").maybeSingle();
  if (memberError || !member || !["owner", "admin"].includes(String(member.role).toLowerCase())) {
    return json({ error: "Only an active business owner or administrator can pay for a website package." }, 403);
  }

  const { data: request, error: requestError } = await admin
    .from("website_service_requests")
    .select("id,company_id,market_code,package_code,package_currency_code,package_amount,deposit_amount,balance_amount,payment_plan,status,payment_status")
    .eq("id", requestId).eq("company_id", companyId).maybeSingle();
  if (requestError) return json({ error: "Could not load the website service request." }, 500);
  if (!request) return json({ error: "The website service request was not found in this business." }, 404);
  if (request.payment_status === "paid") return json({ error: "This website request has already been paid in full." }, 409);
  if (paymentStage === "balance") {
    if (request.payment_status !== "partially_paid" || String(request.status) !== "review") {
      return json({ error: "The remaining balance becomes payable after the website draft is built and the first payment is verified." }, 409);
    }
    const { data: buildJob, error: buildJobError } = await admin.from("website_service_build_jobs")
      .select("status").eq("request_id", request.id).maybeSingle();
    if (buildJobError) return json({ error: "Could not verify that the website draft is ready for final checkout." }, 500);
    if (buildJob?.status !== "ready_for_final_payment") {
      return json({ error: "The website draft is not ready for final checkout yet. Keep the request open and wait for build completion." }, 409);
    }
    const { data: verifiedPayments, error: verifiedPaymentError } = await admin.from("website_service_checkout_payments")
      .select("provider_metadata").eq("request_id", request.id).eq("status", "verified");
    if (verifiedPaymentError) return json({ error: "Could not verify the first website payment." }, 500);
    if (!(verifiedPayments || []).some((p: any) => p.provider_metadata?.payment_stage === "deposit")) {
      return json({ error: "The first website payment is not verified yet." }, 409);
    }
  } else {
    if (request.payment_status === "partially_paid") return json({ error: "The first payment is already verified. The remaining balance becomes payable after website delivery." }, 409);
    if (!["requested", "awaiting_payment"].includes(String(request.status))) {
      return json({ error: "This request is no longer available for the first-payment checkout." }, 409);
    }
  }

  const amount = Number(paymentStage === "balance" ? request.balance_amount : request.deposit_amount);
  const currency = String(request.package_currency_code || "").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !["UGX", "KES", "TZS", "USD"].includes(currency)) {
    return json({ error: "This website request has no valid server-approved package price." }, 409);
  }

  const { data: existing, error: existingError } = await admin
    .from("website_service_checkout_payments").select("id,amount,currency_code,provider_metadata")
    .eq("request_id", request.id).eq("status", "pending").maybeSingle();
  if (existingError) return json({ error: "Could not check the current checkout status." }, 500);
  if (existing) {
    const url = existing.provider_metadata?.checkout_url;
    if (typeof url === "string") {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && parsed.hostname === "pay.jjuma.com") {
          return json({ success: true, payment_url: parsed.toString(), amount: Number(existing.amount),
            currency: String(existing.currency_code).toUpperCase(), status: "pending",
            message: "Continue with the existing secure Jjuma Pay checkout." });
        }
      } catch (_) { /* Treat invalid stored provider URLs as unavailable. */ }
    }
    return json({ error: "A checkout is already pending for this request. Retry after its status has updated." }, 409);
  }

  const { data: payment, error: paymentError } = await admin
    .from("website_service_checkout_payments")
    .insert({
      company_id: companyId, request_id: request.id, created_by: authenticatedUser.id,
      provider: "jjuma", amount, currency_code: currency, status: "pending",
      provider_metadata: {
        product: "molan_website_service", market_code: request.market_code,
        package_code: request.package_code, payment_stage: paymentStage,
        package_amount: Number(request.package_amount), customer_user_id: authenticatedUser.id,
      },
    }).select("id").single();
  if (paymentError || !payment) return json({ error: "Could not create the website checkout record. Please retry." }, 500);

  const requestPendingPatch = paymentStage === "balance"
    ? { payment_status: "partially_paid" }
    : { status: "awaiting_payment", payment_status: "pending" };
  const { error: awaitingError } = await admin.from("website_service_requests")
    .update(requestPendingPatch).eq("id", request.id);
  if (awaitingError) {
    await markWebsiteCheckoutFailed(payment.id, request.id, "Could not mark request as awaiting payment.");
    return json({ error: "Could not prepare this website request for checkout." }, 500);
  }

  const packageName = ({ starter: "Starter", premium: "Premium", business: "Business" } as Record<string, string>)[request.package_code] || "Website";
  const webhookUrl = `${SUPABASE_URL}/functions/v1/molan-jjuma-payments?action=webhook`;
  const redirect = `https://zakpollyqueens.github.io/Molan-business-app-/successful.html?website_payment_id=${encodeURIComponent(payment.id)}`;
  const cancelRedirect = `https://zakpollyqueens.github.io/Molan-business-app-/failed.html?website_payment_id=${encodeURIComponent(payment.id)}`;
  const payload = {
    amount, currency,
    description: `Molan Business ${packageName} website service ${paymentStage === "balance" ? "remaining balance" : "first payment"}`,
    customer_name: authenticatedUser.user_metadata?.full_name || authenticatedUser.email || "Molan Business customer",
    customer_email: authenticatedUser.email,
    redirect_url: redirect, return_url: redirect, cancel_redirect_url: cancelRedirect,
    webhook_url: webhookUrl, external_order_id: payment.id, idempotency_key: payment.id,
    metadata: {
      product: "molan_website_service", company_id: companyId,
      website_request_id: request.id, website_payment_id: payment.id,
      package_code: request.package_code, market_code: request.market_code,
      payment_stage: paymentStage, customer_user_id: authenticatedUser.id,
    },
  };

  try {
    const response = await fetch(`${API_BASE}/payments/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JJUMA_PUBLIC_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const providerResponse = await response.json();
    if (!response.ok || providerResponse?.success !== true || !providerResponse?.data?.transaction_id ||
        typeof providerResponse?.data?.payment_url !== "string") {
      await markWebsiteCheckoutFailed(payment.id, request.id, "Jjuma Pay rejected checkout creation.");
      return json({ error: "Jjuma Pay could not create checkout. No website payment has been marked as paid." }, 502);
    }
    const checkoutUrl = new URL(providerResponse.data.payment_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "pay.jjuma.com") {
      await markWebsiteCheckoutFailed(payment.id, request.id, "Jjuma Pay returned an untrusted checkout URL.");
      return json({ error: "The payment provider returned an untrusted checkout URL." }, 502);
    }
    const { error: providerSaveError } = await admin.from("website_service_checkout_payments").update({
      provider_reference: String(providerResponse.data.transaction_id),
      provider_metadata: {
        product: "molan_website_service", package_code: request.package_code,
        market_code: request.market_code, payment_stage: paymentStage,
        package_amount: Number(request.package_amount), customer_user_id: authenticatedUser.id,
        transaction_id: String(providerResponse.data.transaction_id),
        provider_reference: providerResponse.data.reference ?? null,
        checkout_url: checkoutUrl.toString(), checkout_created: true,
      },
    }).eq("id", payment.id).eq("status", "pending");
    if (providerSaveError) {
      await markWebsiteCheckoutFailed(payment.id, request.id, "Could not save the checkout reference.");
      return json({ error: "Checkout was created but its payment record could not be saved. Contact support before paying again." }, 500);
    }
    return json({
      success: true, payment_url: checkoutUrl.toString(),
      transaction_id: providerResponse.data.transaction_id, amount, currency,
      package: packageName, status: "pending",
      message: "Complete Jjuma Pay checkout. Your website request proceeds after server-side payment verification.",
    });
  } catch (_error) {
    await markWebsiteCheckoutFailed(payment.id, request.id, "Could not contact Jjuma Pay.");
    return json({ error: "Could not contact Jjuma Pay. No website payment has been marked as paid." }, 502);
  }
}

async function createCheckout(req: Request) {
  if (!JJUMA_PUBLIC_KEY) return json({ error: "Payment provider is not configured yet." }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in is required." }, 401);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Your session is invalid or expired." }, 401);

  const body = await req.json().catch(() => null);
  const productCode = String(body?.product ?? "molan_business_subscription").toLowerCase();
  if (productCode === "molan_website_service") return await createWebsiteServiceCheckout(userData.user, body);
  if (productCode !== "molan_business_subscription") return json({ error: "Unsupported checkout product." }, 400);
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
    redirect_url: `https://zakpollyqueens.github.io/Molan-business-app-/successful.html?payment_event_id=${encodeURIComponent(event.id)}`,
    return_url: `https://zakpollyqueens.github.io/Molan-business-app-/successful.html?payment_event_id=${encodeURIComponent(event.id)}`,
    cancel_redirect_url: `https://zakpollyqueens.github.io/Molan-business-app-/failed.html?payment_event_id=${encodeURIComponent(event.id)}`,
    webhook_url: webhookUrl,
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

async function handleWebsiteServiceWebhook(
  websitePayment: any,
  transactionId: string,
  eventName: string,
  data: any,
  deliveryId: string | null,
) {
  if (websitePayment.status === "verified") {
    const stage = websitePayment.provider_metadata?.payment_stage === "balance" ? "balance" : "deposit";
    const followUp = await triggerWebsiteBuilder(stage === "balance" ? "publish" : "build", websitePayment.request_id);
    return json({ success: true, already_processed: true, website_service_paid: true, build_status: followUp.status, publication_pending: stage === "balance" && !followUp.success });
  }
  if (websitePayment.status === "failed") return json({ success: true, ignored: true, payment_status: "failed" });

  if (eventName === "payment.failed" || eventName === "payment.cancelled") {
    const { error: failureError } = await admin.from("website_service_checkout_payments").update({
      status: "failed",
      provider_metadata: { ...(websitePayment.provider_metadata ?? {}), webhook_event: eventName, delivery_id: deliveryId },
    }).eq("id", websitePayment.id).eq("status", "pending");
    if (failureError) return json({ error: "Could not record website payment outcome." }, 500);
    const { data: request, error: requestReadError } = await admin.from("website_service_requests")
      .select("status").eq("id", websitePayment.request_id).maybeSingle();
    if (requestReadError) return json({ error: "Could not update website request payment status." }, 500);
    const isBalanceCheckout = websitePayment.provider_metadata?.payment_stage === "balance";
    const requestPatch: Record<string, unknown> = { payment_status: isBalanceCheckout ? "partially_paid" : "failed" };
    if (!isBalanceCheckout && request?.status === "awaiting_payment") requestPatch.status = "requested";
    const { error: requestUpdateError } = await admin.from("website_service_requests")
      .update(requestPatch).eq("id", websitePayment.request_id);
    if (requestUpdateError) return json({ error: "Could not update website request payment status." }, 500);
    return json({ success: true, payment_status: "failed", website_service: true });
  }
  if (eventName !== "payment.completed") return json({ success: true, ignored: true });

  let verification: any;
  try {
    const verifyResponse = await fetch(`${API_BASE}/payments/verify/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${JJUMA_SECRET_KEY}`, Accept: "application/json" },
    });
    verification = await verifyResponse.json();
    if (!verifyResponse.ok || verification?.status !== "success" ||
        String(verification?.data?.status ?? "").toLowerCase() !== "successful") {
      return json({ error: "Jjuma Pay has not verified this website payment as successful." }, 409);
    }
  } catch (_error) {
    return json({ error: "Could not verify website payment with Jjuma Pay." }, 502);
  }

  const verifiedData = verification.data;
  const amount = Number(verifiedData.amount ?? data.amount);
  const currency = String(verifiedData.currency ?? data.currency ?? "").toUpperCase();
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(Number(websitePayment.amount) * 100) ||
      currency !== String(websitePayment.currency_code).toUpperCase()) {
    return json({ error: "Verified website payment amount or currency does not match the pending checkout." }, 409);
  }

  const { data: request, error: requestError } = await admin.from("website_service_requests")
    .select("id,status,payment_status,balance_amount").eq("id", websitePayment.request_id).maybeSingle();
  if (requestError || !request) return json({ error: "Could not locate the website request for this payment." }, 500);
  const paymentStage = websitePayment.provider_metadata?.payment_stage === "balance" ? "balance" : "deposit";
  const requestPatch: Record<string, unknown> = {
    payment_status: paymentStage === "balance" ? "paid" : "partially_paid",
    payment_provider_reference: transactionId,
  };
  if (paymentStage === "balance") requestPatch.balance_amount = 0;
  else requestPatch.paid_at = verifiedData.paid_at ?? new Date().toISOString();
  if (paymentStage === "deposit" && ["requested", "awaiting_payment"].includes(String(request.status))) requestPatch.status = "in_progress";
  const { error: requestUpdateError } = await admin.from("website_service_requests")
    .update(requestPatch).eq("id", request.id);
  if (requestUpdateError) return json({ error: "Payment was verified but the website request could not be updated. The webhook can be retried." }, 500);

  const { data: markedPayment, error: markError } = await admin.from("website_service_checkout_payments").update({
    status: "verified",
    verified_at: new Date().toISOString(),
    paid_at: verifiedData.paid_at ?? new Date().toISOString(),
    provider_metadata: {
      ...(websitePayment.provider_metadata ?? {}),
      webhook_event: eventName, delivery_id: deliveryId,
      verified_transaction_id: transactionId, verified_amount: amount, verified_currency: currency,
    },
  }).eq("id", websitePayment.id).eq("status", "pending").select("id").maybeSingle();
  if (markError) return json({ error: "Could not record the verified website payment." }, 500);
  if (!markedPayment) {
    const { data: currentPayment } = await admin.from("website_service_checkout_payments")
      .select("status").eq("id", websitePayment.id).maybeSingle();
    if (currentPayment?.status !== "verified") return json({ error: "Could not complete website payment verification." }, 500);
  }
  const followUp = await triggerWebsiteBuilder(paymentStage === "balance" ? "publish" : "build", request.id);
  return json({ success: true, website_service_paid: true, request_id: request.id, build_status: followUp.status, publication_pending: paymentStage === "balance" && !followUp.success });
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
  const eventName = String(eventPayload?.event ?? eventPayload?.event_type ?? req.headers.get("X-Jjuma-Event") ?? "");
  const data = eventPayload?.data ?? {};
  const transactionId = String(data.transaction_id ?? eventPayload.transaction_id ?? "");
  if (!transactionId) return json({ error: "Webhook has no transaction ID." }, 400);

  const { data: paymentEvent, error: eventLookupError } = await admin
    .from("subscription_payment_events").select("*")
    .eq("provider", "jjuma").eq("provider_reference", transactionId).maybeSingle();
  if (eventLookupError) return json({ error: "Could not look up payment record." }, 500);
  if (!paymentEvent) {
    const { data: websitePayment, error: websiteLookupError } = await admin
      .from("website_service_checkout_payments").select("*")
      .eq("provider", "jjuma").eq("provider_reference", transactionId).maybeSingle();
    if (websiteLookupError) return json({ error: "Could not look up website payment record." }, 500);
    if (!websitePayment) {
      // Shared JJuma webhook router: forward unmatched Molan Chat upgrade events to the ZakiChat payment processor.
      // This function has already verified JJuma's signature and timestamp above.
      const chatWebhookUrl = "https://xdpevlurgtvgduwzyoue.supabase.co/functions/v1/jjuma-webhook";
      try {
        const forwarded = await fetch(chatWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Jjuma-Signature": signature,
            "X-Jjuma-Timestamp": timestamp,
            "X-Jjuma-Event": eventName,
            ...(req.headers.get("X-Jjuma-Delivery-Id") ? { "X-Jjuma-Delivery-Id": req.headers.get("X-Jjuma-Delivery-Id")! } : {}),
          },
          body: rawBody,
        });
        const forwardedBody = await forwarded.json().catch(() => ({}));
        if (forwarded.ok) return json({ success: true, routed_to: "molan_chat", result: forwardedBody });
        console.error("Molan Chat JJuma webhook forwarding failed:", forwarded.status, JSON.stringify(forwardedBody));
        return json({ error: "Payment event could not be processed by Molan Chat yet." }, 502);
      } catch (_error) {
        return json({ error: "Could not forward the payment event to Molan Chat." }, 502);
      }
    }
    return await handleWebsiteServiceWebhook(
      websitePayment, transactionId, eventName, data, req.headers.get("X-Jjuma-Delivery-Id"),
    );
  }
  if (paymentEvent.status === "verified") return json({ success: true, already_processed: true });
  if (paymentEvent.status === "failed") return json({ success: true, ignored: true, payment_status: "failed" });
  if (eventName === "payment.failed" || eventName === "payment.cancelled") {
    const failedStatus = "failed"; // The database status constraint uses failed for both failed and cancelled checkouts.
    const { error: failureError } = await admin.from("subscription_payment_events").update({
      status: failedStatus,
      provider_metadata: { ...(paymentEvent.provider_metadata ?? {}), webhook_event: eventName, delivery_id: req.headers.get("X-Jjuma-Delivery-Id") },
    }).eq("id", paymentEvent.id).eq("status", "pending");
    if (failureError) return json({ error: "Could not record the payment outcome." }, 500);
    return json({ success: true, payment_status: failedStatus });
  }
  if (eventName !== "payment.completed") return json({ success: true, ignored: true });

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
