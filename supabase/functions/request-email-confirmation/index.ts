import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey",
};

type ConfirmationType = "signup" | "password_reset";

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const secureToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return respond({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
  const emailApiUrl = Deno.env.get("EMAIL_API_URL")?.trim() || "";
  const emailApiKey = Deno.env.get("EMAIL_API_KEY")?.trim() || "";
  const appDomain = (Deno.env.get("APP_DOMAIN")?.trim() || "https://app.dogcatify.com").replace(/\/+$/, "");
  const suppliedKey = req.headers.get("apikey")?.trim() || "";

  if (!supabaseUrl || !anonKey || !serviceKey || !emailApiUrl || !emailApiKey) {
    return respond({ success: false, error: "MISSING_SERVER_CONFIG" }, 500);
  }
  if (suppliedKey !== anonKey) return respond({ success: false, error: "UNAUTHORIZED" }, 401);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const type: ConfirmationType = body?.type === "password_reset" ? "password_reset" : "signup";
  const requestedUserId = String(body?.userId || "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return respond({ success: false, error: "INVALID_EMAIL" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user: any = null;
  if (requestedUserId) {
    const { data } = await admin.auth.admin.getUserById(requestedUserId);
    if (data.user?.email?.toLowerCase() === email) user = data.user;
  }

  if (!user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("email", email)
      .maybeSingle();
    if (profile?.id) {
      const { data } = await admin.auth.admin.getUserById(profile.id);
      user = data.user;
    }
  }

  // Do not reveal whether an email is registered.
  if (!user?.id || user.email?.toLowerCase() !== email) return respond({ success: true });

  const token = secureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  await admin
    .from("email_confirmations")
    .update({ is_confirmed: true, confirmed_at: now })
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("is_confirmed", false);

  const { error: insertError } = await admin.from("email_confirmations").insert({
    user_id: user.id,
    email,
    token_hash: token,
    type,
    is_confirmed: false,
    expires_at: expiresAt,
    created_at: now,
  });
  if (insertError) return respond({ success: false, error: "TOKEN_CREATE_FAILED" }, 500);

  const displayName = String(
    body?.displayName || user.user_metadata?.full_name || user.user_metadata?.display_name || "Usuario",
  ).trim();
  const targetPath = type === "password_reset" ? "/auth/reset-password" : "/auth/confirm";
  const query = type === "password_reset"
    ? `token=${encodeURIComponent(token)}`
    : `token_hash=${encodeURIComponent(token)}&type=signup`;
  const targetUrl = `${appDomain}${targetPath}?${query}`;
  const templateName = type === "password_reset" ? "reset-password" : "confirmation";
  const templateData = type === "password_reset"
    ? { client_name: displayName, reset_url: targetUrl }
    : { client_name: displayName, confirmation_url: targetUrl, token, token_hash: token };

  const emailResponse = await fetch(emailApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": emailApiKey,
      "X-Integration-Key": emailApiKey,
      Authorization: `Bearer ${emailApiKey}`,
    },
    body: JSON.stringify({
      template_name: templateName,
      recipient_email: email,
      data: templateData,
      token,
      token_hash: token,
    }),
  });

  const responseText = await emailResponse.text();
  if (!emailResponse.ok) return respond({ success: false, error: "EMAIL_SEND_FAILED" }, 502);

  let logId: string | undefined;
  try {
    logId = JSON.parse(responseText)?.log_id;
  } catch {
    // Some providers return an empty successful response.
  }

  return respond({ success: true, log_id: logId });
});
