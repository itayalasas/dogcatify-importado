import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MERCADOPAGO_BASE_URL = "https://api.mercadopago.com";
const DEFAULT_REDIRECT_URI = "https://dogcatify.com/auth/mercadopago/callback";

type OAuthAction = "exchange" | "refresh";

interface OAuthRequestBody {
  action?: OAuthAction;
  code?: string;
  partnerId?: string;
}

const getSupabase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

const getMercadoPagoCredentials = async (supabase: ReturnType<typeof createClient>) => {
  const envClientId = Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID");
  const clientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
  const redirectUri = Deno.env.get("MERCADOPAGO_REDIRECT_URI") || DEFAULT_REDIRECT_URI;

  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "mercadopago_config")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const dbClientId = data?.value?.client_id || data?.value?.clientId || data?.value?.oauth_client_id || data?.value?.app_id;
  const clientId = String(dbClientId || envClientId || "").trim();

  if (!clientId) {
    throw new Error("MERCADOPAGO_CLIENT_ID is not configured");
  }

  if (!clientSecret) {
    throw new Error("MERCADOPAGO_CLIENT_SECRET is not configured");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });

const readJsonBody = async (req: Request): Promise<OAuthRequestBody> => {
  try {
    const raw = await req.text();
    if (!raw.trim()) return {};
    return JSON.parse(raw) as OAuthRequestBody;
  } catch {
    return {};
  }
};

const safeParseJson = (text: string): Record<string, any> => {
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { raw: text };
  }
};

const persistPartnerTokens = async (
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
  tokenData: Record<string, any>,
  action: OAuthAction
) => {
  const { data: partnerData, error: partnerError } = await supabase
    .from("partners")
    .select("user_id")
    .eq("id", partnerId)
    .single();

  if (partnerError) {
    throw partnerError;
  }

  if (!partnerData?.user_id) {
    throw new Error("Partner user_id not found");
  }

  const { data: existingCreds } = await supabase
    .from("partner_payment_credentials")
    .select("*")
    .eq("user_id", partnerData.user_id)
    .maybeSingle();

  const existingConfig = (existingCreds || {}) as Record<string, any>;
  const now = new Date().toISOString();
  const nextConfig = {
    user_id: partnerData.user_id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || existingConfig.refresh_token || null,
    mp_user_id: tokenData.user_id ?? existingConfig.mp_user_id ?? null,
    public_key: tokenData.public_key || existingConfig.public_key || "",
    connected_at: existingConfig.connected_at || now,
    is_oauth: true,
    is_test_mode: tokenData.live_mode === false || String(tokenData.access_token || "").startsWith("TEST-"),
    token_type: tokenData.token_type || existingConfig.token_type || "bearer",
    expires_in: tokenData.expires_in ?? existingConfig.expires_in ?? null,
    live_mode: tokenData.live_mode ?? existingConfig.live_mode ?? true,
    updated_at: now,
    last_refresh_at: action === "refresh" ? now : existingConfig.last_refresh_at || null,
  };

  const { error: updateError } = await supabase
    .from("partner_payment_credentials")
    .upsert(nextConfig, { onConflict: "user_id" });

  if (updateError) {
    throw updateError;
  }

  const { error: partnerUpdateError } = await supabase
    .from("partners")
    .update({
      mercadopago_connected: true,
      updated_at: now,
    })
    .eq("user_id", partnerData.user_id);

  if (partnerUpdateError) {
    throw partnerUpdateError;
  }

  // Never echo the raw access_token/refresh_token back to the client — the
  // caller only needs to know the connect/refresh succeeded.
  return {
    partnerId,
    userId: partnerData.user_id,
  };
};

const exchangeAuthorizationCode = async (
  code: string,
  partnerId: string
) => {
  const supabase = getSupabase();
  const { clientId, clientSecret, redirectUri } = await getMercadoPagoCredentials(supabase);

  const response = await fetch(`${MERCADOPAGO_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const responseText = await response.text();
  const responseData = safeParseJson(responseText);

  if (!response.ok) {
    throw new Error(responseData?.message || responseData?.error_description || response.statusText);
  }

  return persistPartnerTokens(supabase, partnerId, responseData, "exchange");
};

const refreshPartnerTokens = async (partnerId: string) => {
  const supabase = getSupabase();
  const { clientId, clientSecret } = await getMercadoPagoCredentials(supabase);

  const { data: partnerData, error: partnerError } = await supabase
    .from("partners")
    .select("user_id")
    .eq("id", partnerId)
    .single();

  if (partnerError) {
    throw partnerError;
  }

  const { data: creds, error: credsError } = await supabase
    .from("partner_payment_credentials")
    .select("refresh_token")
    .eq("user_id", partnerData?.user_id)
    .maybeSingle();

  if (credsError) {
    throw credsError;
  }

  const refreshToken = creds?.refresh_token;

  if (!refreshToken) {
    throw new Error("No refresh token available for partner");
  }

  const response = await fetch(`${MERCADOPAGO_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const responseText = await response.text();
  const responseData = safeParseJson(responseText);

  if (!response.ok) {
    throw new Error(responseData?.message || responseData?.error_description || response.statusText);
  }

  return persistPartnerTokens(supabase, partnerId, responseData, "refresh");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await readJsonBody(req);
    const action = body.action;
    const partnerId = String(body.partnerId || "").trim();

    if (!action) {
      return jsonResponse({ error: "Missing action" }, 400);
    }

    if (!partnerId) {
      return jsonResponse({ error: "Missing partnerId" }, 400);
    }

    if (action === "exchange") {
      const code = String(body.code || "").trim();

      if (!code) {
        return jsonResponse({ error: "Missing authorization code" }, 400);
      }

      const result = await exchangeAuthorizationCode(code, partnerId);
      return jsonResponse({
        success: true,
        action,
        ...result,
      });
    }

    if (action === "refresh") {
      const result = await refreshPartnerTokens(partnerId);
      return jsonResponse({
        success: true,
        action,
        ...result,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Mercado Pago OAuth function error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
