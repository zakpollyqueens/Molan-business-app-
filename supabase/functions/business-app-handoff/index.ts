import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set([
  "https://zakpollyqueens.github.io",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  "null", // Electron file:// pages use an opaque origin; requests still require the one-time token or a valid bearer.
]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://zakpollyqueens.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const body = await req.json();
    if (body?.action === "create") {
      const bearer = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
      if (!bearer) return json({ error: "Sign in to Molan Business in this browser before giving app access." }, 401, origin);
      const { data: authUser, error: authError } = await admin.auth.getUser(bearer);
      if (authError || !authUser.user) return json({ error: "Your browser session has expired. Sign in again and retry." }, 401, origin);

      const profileSlug = typeof body.profileSlug === "string" ? body.profileSlug : "";
      const targetDevice = body.targetDevice === "pc" ? "pc" : body.targetDevice === "mobile" ? "mobile" : "";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileSlug) || profileSlug.length > 100) {
        return json({ error: "The business profile could not be verified. Refresh the profile and try again." }, 400, origin);
      }
      if (!targetDevice) return json({ error: "Choose Mobile or PC before continuing." }, 400, origin);

      const token = randomToken();
      const { error } = await admin.from("business_app_auth_handoffs").insert({
        user_id: authUser.user.id,
        token_hash: await hashToken(token),
        profile_slug: profileSlug,
        target_device: targetDevice,
        expires_at: new Date(Date.now() + 120000).toISOString(),
      });
      if (error) {
        console.error("Business app handoff create failed:", error.message);
        return json({ error: "Could not create a secure access request. Please try again." }, 500, origin);
      }
      return json({
        success: true,
        expiresInSeconds: 120,
        appUrl: "molanbusiness://auth-handoff?token=" + token,
        targetDevice,
        profileSlug,
      }, 200, origin);
    }

    if (body?.action === "consume") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!/^[a-f0-9]{64}$/.test(token)) {
        return json({ error: "This access request is invalid. Return to the browser and authorize again." }, 400, origin);
      }
      const { data: claim, error: claimError } = await admin.from("business_app_auth_handoffs")
        .update({ consumed_at: new Date().toISOString() })
        .eq("token_hash", await hashToken(token))
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("user_id, profile_slug, target_device")
        .maybeSingle();
      if (claimError) {
        console.error("Business app handoff claim failed:", claimError.message);
        return json({ error: "Access could not be verified. Please authorize again." }, 500, origin);
      }
      if (!claim?.user_id) {
        return json({ error: "This access request expired or was already used. Return to the browser and authorize again." }, 401, origin);
      }

      const { data: account, error: accountError } = await admin.auth.admin.getUserById(claim.user_id);
      const email = account?.user?.email;
      if (accountError || !email) return json({ error: "The account could not be opened. Sign in on the browser and authorize again." }, 401, origin);

      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const hashedOtp = link?.properties?.hashed_token;
      if (linkError || !hashedOtp) {
        console.error("Business app session mint failed:", linkError?.message || "missing hashed token");
        return json({ error: "A secure app session could not be created. Please try again." }, 500, origin);
      }
      const publicAuth = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data: sessionData, error: sessionError } = await publicAuth.auth.verifyOtp({ type: "magiclink", token_hash: hashedOtp });
      if (sessionError || !sessionData.session) {
        console.error("Business app session exchange failed:", sessionError?.message || "missing session");
        return json({ error: "The app session could not be opened. Please authorize again." }, 500, origin);
      }
      return json({
        success: true,
        profileSlug: claim.profile_slug,
        targetDevice: claim.target_device,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_at: sessionData.session.expires_at,
          expires_in: sessionData.session.expires_in,
          token_type: sessionData.session.token_type,
        },
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          user_metadata: sessionData.user.user_metadata || {},
        },
      }, 200, origin);
    }

    return json({ error: "Unsupported access action." }, 400, origin);
  } catch (error) {
    console.error("Business app handoff failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The app access request could not be processed." }, 500, origin);
  }
});
