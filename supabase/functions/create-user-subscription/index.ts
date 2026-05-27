import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type BillingCycle = "monthly" | "yearly";
type MercadoPagoCredentialMode = "test" | "production";

const MOBILE_APP_SCHEME = "dogcatify";
const DEFAULT_PUBLIC_APP_URL = "https://app-dogcatify.netlify.app";
const SUBSCRIPTION_RETURN_PATH = "/subscription/return";
const SUBSCRIPTION_RETURN_FUNCTION_PATH = "/functions/v1/subscription-return";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getMercadoPagoCredentialMode = (credential: unknown): MercadoPagoCredentialMode | null => {
  const value = String(credential || "").trim();
  if (value.startsWith("TEST-")) return "test";
  if (value.startsWith("APP_USR-")) return "production";
  return null;
};

const expectedMercadoPagoCredentialMode = (config: any): MercadoPagoCredentialMode =>
  config?.is_test_mode === true ? "test" : "production";

const credentialModeLabel = (mode: MercadoPagoCredentialMode) =>
  mode === "test" ? "TEST" : "APP_USR";

const validateMercadoPagoCredentialMode = (config: any) => {
  const expectedMode = expectedMercadoPagoCredentialMode(config);
  const accessTokenMode = getMercadoPagoCredentialMode(config?.access_token);
  const publicKeyMode = config?.public_key
    ? getMercadoPagoCredentialMode(config.public_key)
    : null;

  if (!accessTokenMode) {
    throw new HttpError(400, "MERCADOPAGO_ACCESS_TOKEN_INVALID_FORMAT");
  }

  return {
    expectedMode,
    accessTokenMode,
    publicKeyMode,
    credentialModeMismatch: accessTokenMode !== expectedMode,
    publicKeyInvalidFormat: Boolean(config?.public_key && !publicKeyMode),
    publicKeyModeMismatch: Boolean(publicKeyMode && publicKeyMode !== accessTokenMode),
  };
};

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

  const credentialInfo = validateMercadoPagoCredentialMode(config);

  return {
    ...config,
    credential_mode: credentialInfo.accessTokenMode,
    expected_credential_mode: credentialInfo.expectedMode,
    public_key_mode: credentialInfo.publicKeyMode,
    credential_mode_mismatch: credentialInfo.credentialModeMismatch,
    public_key_invalid_format: credentialInfo.publicKeyInvalidFormat,
    public_key_mode_mismatch: credentialInfo.publicKeyModeMismatch,
  };
};

const fetchMercadoPago = async (
  accessToken: string,
  path: string,
  init: RequestInit = {},
) => {
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

const fetchMercadoPagoOptional = async (
  accessToken: string,
  path: string,
  init: RequestInit = {},
) => {
  try {
    return await fetchMercadoPago(accessToken, path, init);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.warn("Optional Mercado Pago fetch failed:", {
      path,
      status,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCycleFields = (cycle: BillingCycle) => ({
  planId: cycle === "monthly" ? "mercadopago_monthly_plan_id" : "mercadopago_yearly_plan_id",
  initPoint: cycle === "monthly" ? "mercadopago_monthly_init_point" : "mercadopago_yearly_init_point",
  price: cycle === "monthly" ? "price_monthly" : "price_yearly",
});

const mapPreapprovalStatus = (status: string | null | undefined) => {
  switch (String(status || "").toLowerCase()) {
    case "authorized":
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "cancelled":
    case "canceled":
    case "rejected":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
};

const normalizeHttpsBaseUrl = (value: unknown) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:") return null;

    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");

    return url.toString().replace(/\/$/, "");
  } catch (_error) {
    return null;
  }
};

const getPublicAppBaseUrl = () =>
  normalizeHttpsBaseUrl(Deno.env.get("APP_URL")) ||
  normalizeHttpsBaseUrl(Deno.env.get("EXPO_PUBLIC_APP_DOMAIN")) ||
  DEFAULT_PUBLIC_APP_URL;

const buildMobileSubscriptionDeepLink = (subscriptionId: string) => {
  const url = new URL(`${MOBILE_APP_SCHEME}://profile/subscription`);
  url.searchParams.set("subscription_id", subscriptionId);
  return url.toString();
};

const getSubscriptionReturnUrl = (supabaseUrl?: string) => {
  const normalizedSupabaseUrl = normalizeHttpsBaseUrl(supabaseUrl);
  if (normalizedSupabaseUrl) {
    return new URL(SUBSCRIPTION_RETURN_FUNCTION_PATH, `${normalizedSupabaseUrl}/`);
  }

  return new URL(SUBSCRIPTION_RETURN_PATH, `${getPublicAppBaseUrl()}/`);
};

const buildBackUrl = (subscriptionId: string, supabaseUrl?: string) => {
  const url = getSubscriptionReturnUrl(supabaseUrl);
  url.searchParams.set("subscription_id", subscriptionId);
  url.searchParams.set("scope", "user");
  url.searchParams.set("target", buildMobileSubscriptionDeepLink(subscriptionId));
  return url.toString();
};

const getPayerEmail = (user: any, profile: any) =>
  String(profile?.email || user.email || "").trim().toLowerCase();

const getPreapprovalPayerEmail = (preapproval: any) => {
  const email =
    preapproval?.payer_email ||
    preapproval?.payer?.email ||
    preapproval?.subscriber?.email ||
    null;

  return email ? String(email).trim().toLowerCase() : "";
};

const getSearchResults = (body: any) =>
  Array.isArray(body?.results) ? body.results : [];

const findMercadoPagoPreapprovalForSubscription = async (
  accessToken: string,
  subscription: any,
) => {
  const preapprovalId = String(subscription?.mercadopago_preapproval_id || "").trim();
  if (preapprovalId) {
    const preapproval = await fetchMercadoPagoOptional(accessToken, `/preapproval/${preapprovalId}`);
    if (preapproval) return preapproval;
  }

  const externalReference = String(subscription?.id || "").trim();
  if (externalReference) {
    const query = new URLSearchParams({ external_reference: externalReference });
    const search = await fetchMercadoPagoOptional(accessToken, `/preapproval/search?${query.toString()}`);
    const match = getSearchResults(search).find((item: any) =>
      String(item?.external_reference || "") === externalReference
    );
    if (match) return match;
  }

  const mpPlanId = String(subscription?.mercadopago_preapproval_plan_id || "").trim();
  const payerEmail = String(subscription?.metadata?.payer_email || "").trim().toLowerCase();
  if (mpPlanId && payerEmail) {
    const query = new URLSearchParams({
      preapproval_plan_id: mpPlanId,
      payer_email: payerEmail,
    });
    const search = await fetchMercadoPagoOptional(accessToken, `/preapproval/search?${query.toString()}`);
    const match = getSearchResults(search).find((item: any) =>
      String(item?.preapproval_plan_id || "") === mpPlanId &&
      getPreapprovalPayerEmail(item) === payerEmail
    );
    if (match) return match;
  }

  return null;
};

const loadLocalSubscription = async (supabase: any, userId: string, subscriptionId: string) => {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select(`
      *,
      subscription_plans (
        name,
        description,
        features
      )
    `)
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `SUBSCRIPTION_READ_FAILED: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND");
  }

  return data;
};

const updateLocalSubscriptionFromPreapproval = async (
  supabase: any,
  subscription: any,
  preapproval: any,
) => {
  const now = new Date().toISOString();
  const mappedStatus = mapPreapprovalStatus(preapproval?.status);
  const updatePayload: Record<string, unknown> = {
    status: mappedStatus,
    crm_subscription_id: preapproval?.id || subscription.crm_subscription_id || null,
    mercadopago_preapproval_id: preapproval?.id || subscription.mercadopago_preapproval_id || null,
    mercadopago_preapproval_plan_id: preapproval?.preapproval_plan_id || subscription.mercadopago_preapproval_plan_id || null,
    mercadopago_status: preapproval?.status || subscription.mercadopago_status || "pending",
    payment_url: preapproval?.init_point || subscription.payment_url || null,
    last_synced_at: now,
    metadata: {
      ...(subscription.metadata || {}),
      mp_preapproval: preapproval,
      last_manual_sync: {
        source: "create-user-subscription",
        synced_at: now,
      },
    },
    updated_at: now,
  };

  if (mappedStatus === "active" && !subscription.started_at) {
    updatePayload.started_at = preapproval?.date_created || now;
  }

  if (preapproval?.next_payment_date) {
    updatePayload.expires_at = preapproval.next_payment_date;
  }

  const { error } = await supabase
    .from("user_subscriptions")
    .update(updatePayload)
    .eq("id", subscription.id);

  if (error) {
    throw new HttpError(500, `SUBSCRIPTION_SYNC_UPDATE_FAILED: ${error.message}`);
  }

  return loadLocalSubscription(supabase, subscription.user_id, subscription.id);
};

const syncExistingSubscriptionStatus = async (supabase: any, user: any, body: any) => {
  const subscriptionId = String(body?.subscriptionId || body?.subscription_id || "").trim();
  if (!subscriptionId) {
    throw new HttpError(400, "SUBSCRIPTION_ID_REQUIRED");
  }

  const subscription = await loadLocalSubscription(supabase, user.id, subscriptionId);
  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  const preapproval = await findMercadoPagoPreapprovalForSubscription(mpConfig.access_token, subscription);

  if (!preapproval) {
    return {
      success: true,
      synced: false,
      reason: "MERCADOPAGO_PREAPPROVAL_NOT_FOUND",
      subscription,
      status: subscription.status,
    };
  }

  const updatedSubscription = await updateLocalSubscriptionFromPreapproval(
    supabase,
    subscription,
    preapproval,
  );

  return {
    success: true,
    synced: true,
    subscription: updatedSubscription,
    status: updatedSubscription.status,
    mercadopagoStatus: preapproval?.status || null,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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
    const user = await getAuthUser(supabase, req);
    const body = await req.json();
    const action = String(body?.action || "").trim();

    if (action === "sync-status") {
      return jsonResponse(await syncExistingSubscriptionStatus(supabase, user, body));
    }

    const planId = String(body?.planId || "").trim();
    const billingCycle: BillingCycle = body?.billingCycle === "yearly" ? "yearly" : "monthly";

    if (!planId) {
      throw new HttpError(400, "PLAN_ID_REQUIRED");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new HttpError(500, `PROFILE_READ_FAILED: ${profileError.message}`);
    }

    const payerEmail = getPayerEmail(user, profile);
    if (!payerEmail) {
      throw new HttpError(400, "PAYER_EMAIL_REQUIRED");
    }

    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      throw new HttpError(500, `PLAN_READ_FAILED: ${planError.message}`);
    }

    if (!plan || !plan.is_active) {
      throw new HttpError(404, "PLAN_NOT_AVAILABLE");
    }

    const fields = getCycleFields(billingCycle);
    const price = toNumber(plan[fields.price]);
    const mpPlanId = String(plan[fields.planId] || "").trim();
    const planCheckoutUrl = String(plan[fields.initPoint] || "").trim();
    const now = new Date().toISOString();

    await supabase
      .from("user_subscriptions")
      .update({
        status: "cancelled",
        mercadopago_status: "superseded",
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (price <= 0 || plan.is_default) {
      await supabase
        .from("user_subscriptions")
        .update({
          status: "cancelled",
          mercadopago_status: "superseded",
          updated_at: now,
        })
        .eq("user_id", user.id)
        .in("status", ["active", "pending", "paused"]);

      const { data: freeSubscription, error: freeError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: "active",
          started_at: now,
          billing_cycle: billingCycle,
          metadata: {
            source: "free_plan",
            plan_name: plan.name,
          },
        })
        .select("*")
        .single();

      if (freeError) {
        throw new HttpError(500, `FREE_SUBSCRIPTION_CREATE_FAILED: ${freeError.message}`);
      }

      return jsonResponse({
        success: true,
        subscription: freeSubscription,
        status: "active",
      });
    }

    if (!mpPlanId) {
      throw new HttpError(400, "PLAN_NOT_CONNECTED_TO_MERCADOPAGO");
    }

    const { data: localSubscription, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: "pending",
        billing_cycle: billingCycle,
        mercadopago_preapproval_plan_id: mpPlanId,
        mercadopago_status: "pending",
        metadata: {
          source: "mercadopago",
          plan_name: plan.name,
          billing_cycle: billingCycle,
          price,
          currency: plan.currency || "UYU",
          payer_email: payerEmail,
        },
      })
      .select("*")
      .single();

    if (subscriptionError || !localSubscription) {
      throw new HttpError(500, `SUBSCRIPTION_CREATE_FAILED: ${subscriptionError?.message || "unknown"}`);
    }

    const mpConfig = await getAdminMercadoPagoConfig(supabase);
    console.log("create-user-subscription Mercado Pago config loaded:", {
      isTestMode: mpConfig.is_test_mode ?? null,
      credentialMode: mpConfig.credential_mode,
      expectedCredentialMode: mpConfig.expected_credential_mode,
      credentialModeMismatch: mpConfig.credential_mode_mismatch,
      publicKeyMode: mpConfig.public_key_mode,
      publicKeyInvalidFormat: mpConfig.public_key_invalid_format,
      publicKeyModeMismatch: mpConfig.public_key_mode_mismatch,
      hasAccessToken: !!mpConfig.access_token,
    });

    const preapprovalPayload = {
      preapproval_plan_id: mpPlanId,
      reason: String(plan.name || "DogCatiFy").slice(0, 255),
      external_reference: `user:${localSubscription.id}`,
      payer_email: payerEmail,
      back_url: buildBackUrl(localSubscription.id, supabaseUrl),
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      status: "pending",
      auto_recurring: {
        frequency: billingCycle === "monthly" ? 1 : 12,
        frequency_type: "months",
        transaction_amount: price,
        currency_id: String(plan.currency || "UYU").toUpperCase(),
      },
    };

    try {
      const preapproval = await fetchMercadoPago(mpConfig.access_token, "/preapproval", {
        method: "POST",
        body: JSON.stringify(preapprovalPayload),
      });

      const mappedStatus = mapPreapprovalStatus(preapproval?.status);
      const updatePayload = {
        status: mappedStatus,
        crm_subscription_id: preapproval?.id || null,
        mercadopago_preapproval_id: preapproval?.id || null,
        mercadopago_status: preapproval?.status || "pending",
        payment_url: preapproval?.init_point || planCheckoutUrl || null,
        started_at: mappedStatus === "active" ? now : null,
        last_synced_at: now,
        metadata: {
          ...(localSubscription.metadata || {}),
          mp_preapproval: preapproval,
          preapproval_payload: {
            ...preapprovalPayload,
            payer_email: payerEmail,
          },
        },
        updated_at: now,
      };

      const { data: updatedSubscription, error: updateError } = await supabase
        .from("user_subscriptions")
        .update(updatePayload)
        .eq("id", localSubscription.id)
        .select("*")
        .single();

      if (updateError) {
        throw new HttpError(500, `SUBSCRIPTION_UPDATE_FAILED: ${updateError.message}`);
      }

      return jsonResponse({
        success: true,
        subscription: updatedSubscription,
        status: mappedStatus,
        paymentUrl: preapproval?.init_point || planCheckoutUrl || null,
      });
    } catch (mpError) {
      if (!planCheckoutUrl) {
        throw mpError;
      }

      const { data: fallbackSubscription, error: fallbackError } = await supabase
        .from("user_subscriptions")
        .update({
          payment_url: planCheckoutUrl,
          metadata: {
            ...(localSubscription.metadata || {}),
            mp_plan_checkout_fallback: true,
            mp_preapproval_error: mpError instanceof Error ? mpError.message : String(mpError),
            preapproval_payload: {
              ...preapprovalPayload,
              payer_email: payerEmail,
            },
          },
          updated_at: now,
        })
        .eq("id", localSubscription.id)
        .select("*")
        .single();

      if (fallbackError) {
        throw new HttpError(500, `SUBSCRIPTION_FALLBACK_UPDATE_FAILED: ${fallbackError.message}`);
      }

      return jsonResponse({
        success: true,
        subscription: fallbackSubscription,
        status: "pending",
        paymentUrl: planCheckoutUrl,
        fallback: true,
      });
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    console.error("create-user-subscription error:", error);

    return jsonResponse({
      success: false,
      error: message,
    }, status);
  }
});
