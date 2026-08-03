import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Apikey, Content-Type, X-Client-Info",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });

const readValue = (key: string, fallback = "") =>
  String(Deno.env.get(key) || fallback).trim();

const safePublicVariables = () => {
  const supabaseUrl = readValue("SUPABASE_URL");

  return {
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: readValue("SUPABASE_ANON_KEY"),
    EXPO_ROUTER_APP_ROOT: "app",
    EXPO_PUBLIC_PROJECT_ID: readValue("MOBILE_PROJECT_ID"),
    EXPO_PUBLIC_PRIVACY_POLICY_URL: readValue(
      "MOBILE_PRIVACY_POLICY_URL",
      "https://dogcatify.com/privacy-policy",
    ),
    EXPO_PUBLIC_TERMS_OF_SERVICE_URL: readValue(
      "MOBILE_TERMS_OF_SERVICE_URL",
      "https://dogcatify.com/terms-of-service",
    ),
    EXPO_PUBLIC_APP_DOMAIN: readValue("MOBILE_APP_DOMAIN", "https://app.dogcatify.com"),
    EXPO_PUBLIC_NOMINATIM_BASE_URL: readValue(
      "MOBILE_NOMINATIM_BASE_URL",
      "https://nominatim.openstreetmap.org",
    ),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: readValue("MOBILE_GOOGLE_MAPS_API_KEY"),
    EXPO_PUBLIC_EMAIL_API_URL: supabaseUrl ? `${supabaseUrl}/functions/v1/send-email` : "",
    EXPO_PUBLIC_CONFIRM_EMAIL_API_URL: supabaseUrl ? `${supabaseUrl}/functions/v1/confirm-email` : "",
    EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID: readValue("MOBILE_MERCADOPAGO_CLIENT_ID"),
    EXPO_PUBLIC_DATADOG_CLIENT_TOKEN: readValue("MOBILE_DATADOG_CLIENT_TOKEN"),
    EXPO_PUBLIC_DATADOG_APPLICATION_ID: readValue("MOBILE_DATADOG_APPLICATION_ID"),
    EXPO_PUBLIC_DATADOG_ENV: readValue("MOBILE_DATADOG_ENV", "production"),
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const expectedAnonKey = readValue("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  const bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!expectedAnonKey || (apikey !== expectedAnonKey && bearerToken !== expectedAnonKey)) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  const variables = safePublicVariables();
  if (!variables.EXPO_PUBLIC_SUPABASE_URL || !variables.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "MISSING_PUBLIC_CONFIGURATION" }, 500);
  }

  return jsonResponse({
    project_name: "DogCatiFy",
    variables,
    updated_at: new Date().toISOString(),
  });
});
