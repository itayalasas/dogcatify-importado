import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const getAuthUser = async (supabase: any, req: Request) => {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new HttpError(401, "AUTH_REQUIRED");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError(401, "INVALID_AUTH_TOKEN");
  }

  return data.user;
};

const isAdminUser = async (supabase: any, userId: string, email?: string | null) => {
  const normalizedEmail = String(email || "").toLowerCase();

  if (normalizedEmail === "admin@dogcatify.com") {
    return true;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", userId)
    .maybeSingle();

  return profile?.is_admin === true || String(profile?.email || normalizedEmail).toLowerCase() === "admin@dogcatify.com";
};

const requirePartnerAccess = async (supabase: any, user: any, partnerId: string) => {
  const isAdmin = await isAdminUser(supabase, user.id, user.email);

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, user_id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at, subscription_plan_metadata")
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `PARTNER_READ_FAILED: ${error.message}`);
  }

  if (!partner) {
    throw new HttpError(404, "PARTNER_NOT_FOUND");
  }

  if (!isAdmin && partner.user_id !== user.id) {
    throw new HttpError(403, "PARTNER_ACCESS_DENIED");
  }

  return partner;
};

const getAdminMercadoPagoConfig = async (supabase: any) => {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "mercadopago_config")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `MP_CONFIG_READ_FAILED: ${error.message}`);
  }

  const config = data?.value || {};
  if (!config.access_token) {
    throw new HttpError(400, "MERCADOPAGO_ACCESS_TOKEN_REQUIRED");
  }

  return config;
};

const fetchMercadoPago = async (accessToken: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  const rawBody = await response.text();
  let body: any = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch (_error) {
    body = rawBody;
  }

  if (!response.ok) {
    const message = typeof body === "object"
      ? body?.message || body?.error || JSON.stringify(body)
      : String(body || response.statusText);

    throw new HttpError(response.status, `MERCADOPAGO_API_ERROR: ${message}`);
  }

  return body;
};

const isValidDate = (value?: string | null) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const getCurrentAccessExpiresAt = (subscription: any) => {
  if (isValidDate(subscription?.expires_at)) {
    return subscription.expires_at;
  }

  if (isValidDate(subscription?.trial_ends_at)) {
    return subscription.trial_ends_at;
  }

  return new Date().toISOString();
};

const updatePartnerProfileSubscription = async (
  supabase: any,
  partnerId: string,
  patch: Record<string, unknown>,
) => {
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("user_id")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) {
    throw new HttpError(500, `PARTNER_PROFILE_READ_FAILED: ${partnerError.message}`);
  }

  if (!partner?.user_id) {
    throw new HttpError(404, "PARTNER_NOT_FOUND");
  }

  const { error } = await supabase
    .from("partners")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", partner.user_id);

  if (error) {
    throw new HttpError(500, `PARTNER_PROFILE_UPDATE_FAILED: ${error.message}`);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new HttpError(500, "SUPABASE_ENV_REQUIRED");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const user = await getAuthUser(supabase, req);

    const partnerId = String(body?.partnerId || body?.businessId || "").trim();
    const subscriptionId = String(body?.subscriptionId || body?.id || "").trim();

    if (!partnerId) {
      throw new HttpError(400, "PARTNER_ID_REQUIRED");
    }

    const partner = await requirePartnerAccess(supabase, user, partnerId);

    let { data: localSubscription, error: subscriptionError } = subscriptionId
      ? await supabase
        .from("partner_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .eq("partner_id", partnerId)
        .maybeSingle()
      : await supabase
        .from("partner_subscriptions")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      throw new HttpError(500, `PARTNER_SUBSCRIPTION_READ_FAILED: ${subscriptionError.message}`);
    }

    if (!localSubscription) {
      throw new HttpError(404, "PARTNER_SUBSCRIPTION_NOT_FOUND");
    }

    if (String(localSubscription.status || "").toLowerCase() === "cancelled") {
      return jsonResponse({
        success: true,
        subscription: localSubscription,
        alreadyCancelled: true,
      });
    }

    let mpStatus = "canceled";
    try {
      const mpConfig = await getAdminMercadoPagoConfig(supabase);
      if (localSubscription.mercadopago_preapproval_id) {
        const mpResponse = await fetchMercadoPago(
          mpConfig.access_token,
          `/preapproval/${localSubscription.mercadopago_preapproval_id}`,
          {
            method: "PUT",
            body: JSON.stringify({ status: "canceled" }),
          },
        );
        mpStatus = String(mpResponse?.status || mpStatus);
      }
    } catch (mpError) {
      console.warn("Could not cancel Mercado Pago subscription, continuing with local cancellation:", {
        message: mpError instanceof Error ? mpError.message : String(mpError),
      });
    }

    const now = new Date().toISOString();
    const nextAccessEndsAt = getCurrentAccessExpiresAt(localSubscription);
    const subscriptionTier = String(partner.subscription_plan_tier || "starter").toLowerCase();

    const { error: updateError } = await supabase
      .from("partner_subscriptions")
      .update({
        status: "cancelled",
        canceled_at: now,
        mercadopago_status: mpStatus,
        last_synced_at: now,
        expires_at: nextAccessEndsAt,
        metadata: {
          ...(localSubscription.metadata || {}),
          cancelled_at: now,
          cancelled_by: user.id,
          cancellation_source: "partner-app",
        },
        updated_at: now,
      })
      .eq("id", localSubscription.id);

    if (updateError) {
      throw new HttpError(500, `PARTNER_SUBSCRIPTION_UPDATE_FAILED: ${updateError.message}`);
    }

    await updatePartnerProfileSubscription(supabase, partnerId, {
      subscription_plan_tier: subscriptionTier,
      subscription_plan_status: "cancelled",
      subscription_plan_expires_at: nextAccessEndsAt,
      subscription_plan_metadata: {
        ...(partner.subscription_plan_metadata || {}),
        cancelled_at: now,
        cancelled_subscription_id: localSubscription.id,
        cancelled_plan_id: localSubscription.plan_id,
        cancelled_plan_tier: subscriptionTier,
        cancellation_source: "partner-app",
      },
    });

    const { data: updatedSubscription } = await supabase
      .from("partner_subscriptions")
      .select("*")
      .eq("id", localSubscription.id)
      .maybeSingle();

    return jsonResponse({
      success: true,
      subscription: updatedSubscription || localSubscription,
      status: "cancelled",
      accessEndsAt: nextAccessEndsAt,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return jsonResponse({
      success: false,
      error: message,
      durationMs: Date.now() - startedAt,
    }, status);
  }
});
