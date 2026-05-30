import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type BillingCycle = "monthly" | "yearly";
type PartnerSubscriptionStatus = "pending" | "trialing" | "active" | "paused" | "cancelled" | "expired" | "past_due";

const MOBILE_APP_SCHEME = "dogcatify";
const DEFAULT_PUBLIC_APP_URL = "https://app-dogcatify.netlify.app";
const SUBSCRIPTION_RETURN_PATH = "/subscription/return";
const SUBSCRIPTION_RETURN_FUNCTION_PATH = "/functions/v1/subscription-return";
const PARTNER_REFERENCE_PREFIX = "partner";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  return profile?.is_admin === true;
};

const requirePartnerAccess = async (supabase: any, user: any, partnerId: string) => {
  const isAdmin = await isAdminUser(supabase, user.id, user.email);

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, user_id, business_name, business_type, subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at, mercadopago_config")
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

const getCycleFields = (cycle: BillingCycle) => ({
  planId: cycle === "monthly" ? "mercadopago_monthly_plan_id" : "mercadopago_yearly_plan_id",
  initPoint: cycle === "monthly" ? "mercadopago_monthly_init_point" : "mercadopago_yearly_init_point",
  price: cycle === "monthly" ? "price_monthly" : "price_yearly",
});

const getSubscriptionStatusLabel = (status: PartnerSubscriptionStatus) => {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "past_due":
      return "past_due";
    case "pending":
    default:
      return "pending";
  }
};

const mapPreapprovalStatusToLocalStatus = (status: string | null | undefined): PartnerSubscriptionStatus => {
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

const buildReturnUrl = (subscriptionId: string, partnerId: string, supabaseUrl?: string) => {
  const baseUrl = normalizeHttpsBaseUrl(supabaseUrl) || getPublicAppBaseUrl();
  const url = new URL(
    normalizeHttpsBaseUrl(supabaseUrl)
      ? `${SUBSCRIPTION_RETURN_FUNCTION_PATH}`
      : `${SUBSCRIPTION_RETURN_PATH}`,
    `${baseUrl}/`,
  );

  if (normalizeHttpsBaseUrl(supabaseUrl)) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/partner/${encodeURIComponent(partnerId)}/${encodeURIComponent(subscriptionId)}`;
  }
  url.searchParams.set("subscription_id", subscriptionId);
  url.searchParams.set("scope", "partner");
  url.searchParams.set("business_id", partnerId);
  url.searchParams.set("target", buildDeepLink(subscriptionId, partnerId));
  return url.toString();
};

const buildDeepLink = (subscriptionId: string, partnerId: string) => {
  const url = new URL(`${MOBILE_APP_SCHEME}://partner/subscription`);
  url.searchParams.set("subscription_id", subscriptionId);
  url.searchParams.set("businessId", partnerId);
  return url.toString();
};

const getPayerEmail = (user: any, profile: any) =>
  String(profile?.email || user.email || "").trim().toLowerCase();

const isValidDate = (value?: string | null) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const addDays = (date: string | Date, days: number) => {
  const base = typeof date === "string" ? new Date(date) : new Date(date);
  base.setDate(base.getDate() + days);
  return base.toISOString();
};

const hasUsedPartnerTrial = async (supabase: any, partnerId: string | string[]) => {
  const partnerIds = Array.isArray(partnerId) ? partnerId.filter(Boolean) : [partnerId].filter(Boolean);
  if (partnerIds.length === 0) {
    return false;
  }
  const query = supabase
    .from("partner_subscriptions")
    .select("id")
    .eq("trial_used", true)
    .limit(1);

  const { data, error } = partnerIds.length > 1
    ? await query.in("partner_id", partnerIds).maybeSingle()
    : await query.eq("partner_id", partnerIds[0]).maybeSingle();

  if (error) {
    throw new HttpError(500, `PARTNER_TRIAL_LOOKUP_FAILED: ${error.message}`);
  }

  return Boolean(data);
};

const getCurrentPartnerSubscription = async (supabase: any, partnerId: string | string[]) => {
  const partnerIds = Array.isArray(partnerId) ? partnerId.filter(Boolean) : [partnerId].filter(Boolean);
  if (partnerIds.length === 0) {
    return null;
  }
  const query = supabase
    .from("partner_subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data, error } = partnerIds.length > 1
    ? await query.in("partner_id", partnerIds).maybeSingle()
    : await query.eq("partner_id", partnerIds[0]).maybeSingle();

  if (error) {
    throw new HttpError(500, `PARTNER_SUBSCRIPTION_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data) return null;

  const status = String(data.status || "").toLowerCase();
  const now = Date.now();
  const expiresAt = isValidDate(data.expires_at) ? new Date(data.expires_at).getTime() : null;
  const stillAccessing =
    status === "pending" ||
    status === "trialing" ||
    status === "active" ||
    status === "paused" ||
    (status === "cancelled" && expiresAt !== null && expiresAt > now);

  return stillAccessing ? data : null;
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

const syncLocalPartnerSubscriptionFromPreapproval = async (supabase: any, partnerId: string, subscriptionId: string) => {
  const { data: localSubscription, error } = await supabase
    .from("partner_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error || !localSubscription) {
    throw new HttpError(404, "PARTNER_SUBSCRIPTION_NOT_FOUND");
  }

  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  const preapproval = await fetchMercadoPago(mpConfig.access_token, `/preapproval/${localSubscription.mercadopago_preapproval_id || ""}`);

  const now = new Date().toISOString();
  const mappedStatus = mapPreapprovalStatusToLocalStatus(preapproval?.status);
  const trialEnd = isValidDate(localSubscription.trial_ends_at) ? localSubscription.trial_ends_at : null;
  const isTrialing = Boolean(
    localSubscription.trial_used &&
    trialEnd &&
    new Date(trialEnd).getTime() > Date.now() &&
    mappedStatus === "active",
  );

  const nextStatus: PartnerSubscriptionStatus = isTrialing ? "trialing" : mappedStatus;

  const { error: updateError } = await supabase
    .from("partner_subscriptions")
    .update({
      status: nextStatus,
      crm_subscription_id: preapproval?.id || localSubscription.crm_subscription_id || null,
      mercadopago_preapproval_id: preapproval?.id || localSubscription.mercadopago_preapproval_id || null,
      mercadopago_preapproval_plan_id: preapproval?.preapproval_plan_id || localSubscription.mercadopago_preapproval_plan_id || null,
      mercadopago_status: preapproval?.status || localSubscription.mercadopago_status || "pending",
      payment_url: preapproval?.init_point || localSubscription.payment_url || null,
      started_at: localSubscription.started_at || preapproval?.date_created || now,
      expires_at: preapproval?.next_payment_date || trialEnd || localSubscription.expires_at || null,
      last_synced_at: now,
      metadata: {
        ...(localSubscription.metadata || {}),
        mp_preapproval: preapproval,
        last_return_sync: {
          synced_at: now,
        },
      },
      updated_at: now,
    })
    .eq("id", localSubscription.id);

  if (updateError) {
    throw new HttpError(500, `PARTNER_SUBSCRIPTION_UPDATE_FAILED: ${updateError.message}`);
  }

  const newStatus = getSubscriptionStatusLabel(nextStatus);

  await updatePartnerProfileSubscription(supabase, partnerId, {
    subscription_plan_tier: String(localSubscription.metadata?.plan_tier || "starter"),
    subscription_plan_status: nextStatus,
    subscription_plan_started_at: localSubscription.started_at || preapproval?.date_created || now,
    subscription_plan_expires_at: preapproval?.next_payment_date || trialEnd || localSubscription.expires_at || null,
    subscription_plan_metadata: {
      ...(localSubscription.metadata || {}),
      mp_preapproval: preapproval,
      local_status_label: newStatus,
      last_return_sync_at: now,
    },
  });

  return {
    ...localSubscription,
    status: nextStatus,
    mercadopago_status: preapproval?.status || localSubscription.mercadopago_status || "pending",
    payment_url: preapproval?.init_point || localSubscription.payment_url || null,
  };
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

    const action = String(body?.action || "create").toLowerCase();
    const partnerId = String(body?.partnerId || body?.businessId || "").trim();
    const planId = String(body?.planId || "").trim();
    const billingCycle: BillingCycle = body?.billingCycle === "yearly" ? "yearly" : "monthly";

    if (!partnerId) {
      throw new HttpError(400, "PARTNER_ID_REQUIRED");
    }

    const partner = await requirePartnerAccess(supabase, user, partnerId);
    const { data: partnerScopeRows, error: partnerScopeError } = await supabase
      .from("partners")
      .select("id")
      .eq("user_id", partner.user_id);

    if (partnerScopeError) {
      throw new HttpError(500, `PARTNER_SCOPE_READ_FAILED: ${partnerScopeError.message}`);
    }

    const partnerScopeIds = (partnerScopeRows || [])
      .map((row: any) => String(row.id || "").trim())
      .filter(Boolean);
    if (partnerScopeIds.length === 0) {
      partnerScopeIds.push(partnerId);
    }

    if (action === "sync-status") {
      const subscriptionId = String(body?.subscriptionId || "").trim();
      if (!subscriptionId) {
        throw new HttpError(400, "SUBSCRIPTION_ID_REQUIRED");
      }

      const syncedSubscription = await syncLocalPartnerSubscriptionFromPreapproval(supabase, partnerId, subscriptionId);

      return jsonResponse({
        success: true,
        subscription: syncedSubscription,
      });
    }

    if (!planId) {
      throw new HttpError(400, "PLAN_ID_REQUIRED");
    }

    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      throw new HttpError(500, `PLAN_READ_FAILED: ${planError.message}`);
    }

    if (!plan) {
      throw new HttpError(404, "PLAN_NOT_FOUND");
    }

    const audienceTarget = String(plan.audience_target || "users").toLowerCase();
    if (!["partners", "all"].includes(audienceTarget)) {
      throw new HttpError(403, "PLAN_NOT_AVAILABLE_FOR_PARTNERS");
    }

    if (!plan.is_active) {
      throw new HttpError(400, "PLAN_INACTIVE");
    }

    const fields = getCycleFields(billingCycle);
    const price = Number(plan[fields.price] || 0);
    const mpPlanId = String(plan[fields.planId] || "").trim();
    const planCheckoutUrl = String(plan[fields.initPoint] || "").trim();
    const trialDays = Math.max(0, Math.trunc(Number(plan.trial_days || 0)));
    const currentSubscription = await getCurrentPartnerSubscription(supabase, partnerScopeIds);
    const trialAlreadyUsed = await hasUsedPartnerTrial(supabase, partnerScopeIds);
    const canGrantTrial = trialDays > 0 && !trialAlreadyUsed;
    const now = new Date().toISOString();
    const payerEmail = getPayerEmail(user, null);

    if (price <= 0 || String(plan.tier || "").toLowerCase() === "starter") {
      await updatePartnerProfileSubscription(supabase, partnerId, {
        subscription_plan_tier: "starter",
        subscription_plan_status: "active",
        subscription_plan_started_at: partner.subscription_plan_started_at || now,
        subscription_plan_expires_at: null,
        subscription_plan_metadata: {
          action: "free_partner_plan",
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle: billingCycle,
        },
      });

      return jsonResponse({
        success: true,
        status: "active",
        subscription: null,
        paymentUrl: null,
      });
    }

    if (currentSubscription) {
      const currentStatus = String(currentSubscription.status || "").toLowerCase();
      const currentExpiry = isValidDate(currentSubscription.expires_at)
        ? new Date(currentSubscription.expires_at).getTime()
        : null;
      const hasFutureAccess = currentExpiry !== null && currentExpiry > Date.now();

      if (
        currentStatus === "pending" ||
        currentStatus === "trialing" ||
        currentStatus === "active" ||
        currentStatus === "paused" ||
        (currentStatus === "cancelled" && hasFutureAccess)
      ) {
        throw new HttpError(409, "PARTNER_SUBSCRIPTION_ALREADY_ACTIVE");
      }
    }

    if (!mpPlanId) {
      throw new HttpError(400, "PLAN_NOT_CONNECTED_TO_MERCADOPAGO");
    }

    const localSubscriptionInsert: Record<string, unknown> = {
      partner_id: partnerId,
      plan_id: plan.id,
      status: "pending",
      billing_cycle: billingCycle,
      trial_days: trialDays,
      trial_started_at: canGrantTrial ? now : null,
      trial_ends_at: canGrantTrial ? addDays(now, trialDays) : null,
      trial_used: canGrantTrial,
      mercadopago_preapproval_plan_id: mpPlanId,
      mercadopago_status: "pending",
      metadata: {
        source: "create-partner-subscription",
        partner_id: partnerId,
        plan_id: plan.id,
        plan_tier: plan.tier,
        plan_name: plan.name,
        billing_cycle: billingCycle,
        price,
        currency: String(plan.currency || "UYU").toUpperCase(),
        payer_email: payerEmail,
        trial_days: trialDays,
        trial_granted: canGrantTrial,
      },
    };

    const { data: localSubscription, error: insertError } = await supabase
      .from("partner_subscriptions")
      .insert(localSubscriptionInsert)
      .select("*")
      .single();

    if (insertError || !localSubscription) {
      throw new HttpError(500, `PARTNER_SUBSCRIPTION_CREATE_FAILED: ${insertError?.message || "unknown"}`);
    }

    console.log("[CreatePartnerSubscription] Local partner subscription created", {
      local_subscription_id: localSubscription.id,
      partner_id: partnerId,
      plan_id: plan.id,
      plan_name: plan.name,
      plan_tier: plan.tier,
      billing_cycle: billingCycle,
      trial_granted: canGrantTrial,
      payer_email: payerEmail,
      mp_plan_id: mpPlanId,
    });

    const mpConfig = await getAdminMercadoPagoConfig(supabase);
    const preapprovalPayload = {
      preapproval_plan_id: mpPlanId,
      reason: String(plan.name || "DogCatiFy").slice(0, 255),
      external_reference: `${PARTNER_REFERENCE_PREFIX}:${localSubscription.id}`,
      payer_email: payerEmail,
      back_url: buildReturnUrl(localSubscription.id, partnerId, supabaseUrl),
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      status: "pending",
      auto_recurring: {
        frequency: billingCycle === "monthly" ? 1 : 12,
        frequency_type: "months",
        transaction_amount: price,
        currency_id: String(plan.currency || "UYU").toUpperCase(),
      },
    };

    console.log("[CreatePartnerSubscription] Creating Mercado Pago preapproval", {
      local_subscription_id: localSubscription.id,
      partner_id: partnerId,
      external_reference: preapprovalPayload.external_reference,
      notification_url: preapprovalPayload.notification_url,
      back_url: preapprovalPayload.back_url,
      payer_email: payerEmail,
      billing_cycle: billingCycle,
      transaction_amount: price,
      trial_granted: canGrantTrial,
      currency_id: preapprovalPayload.auto_recurring.currency_id,
    });

    try {
      const preapproval = await fetchMercadoPago(mpConfig.access_token, "/preapproval", {
        method: "POST",
        body: JSON.stringify(preapprovalPayload),
      });

      console.log("[CreatePartnerSubscription] Mercado Pago preapproval response received", {
        local_subscription_id: localSubscription.id,
        partner_id: partnerId,
        mp_preapproval_id: preapproval?.id || null,
        mp_status: preapproval?.status || null,
        init_point: preapproval?.init_point || null,
      });

      const mappedStatus = mapPreapprovalStatusToLocalStatus(preapproval?.status);
      const finalStatus: PartnerSubscriptionStatus = canGrantTrial ? "trialing" : mappedStatus;
      const expiresAt = preapproval?.next_payment_date || localSubscription.trial_ends_at || null;
      const nowIso = new Date().toISOString();

      const { data: updatedSubscription, error: updateError } = await supabase
        .from("partner_subscriptions")
        .update({
          status: finalStatus,
          crm_subscription_id: preapproval?.id || null,
          mercadopago_preapproval_id: preapproval?.id || null,
          mercadopago_status: preapproval?.status || "pending",
          payment_url: preapproval?.init_point || planCheckoutUrl || null,
          started_at: finalStatus === "trialing" ? localSubscription.trial_started_at || nowIso : nowIso,
          expires_at: expiresAt,
          last_synced_at: nowIso,
          metadata: {
            ...(localSubscription.metadata || {}),
            mp_preapproval: preapproval,
            preapproval_payload: {
              ...preapprovalPayload,
              payer_email: payerEmail,
            },
          },
          updated_at: nowIso,
        })
        .eq("id", localSubscription.id)
        .select("*")
        .single();

      if (updateError) {
        throw new HttpError(500, `PARTNER_SUBSCRIPTION_UPDATE_FAILED: ${updateError.message}`);
      }

      console.log("[CreatePartnerSubscription] Local partner subscription synced after preapproval create", {
        local_subscription_id: updatedSubscription?.id || localSubscription.id,
        partner_id: partnerId,
        status: finalStatus,
        mp_preapproval_id: preapproval?.id || null,
        mp_status: preapproval?.status || null,
      });

      await updatePartnerProfileSubscription(supabase, partnerId, {
        subscription_plan_tier: String(plan.tier || "starter"),
        subscription_plan_status: finalStatus,
        subscription_plan_started_at: finalStatus === "trialing" ? localSubscription.trial_started_at || nowIso : nowIso,
        subscription_plan_expires_at: expiresAt,
        subscription_plan_metadata: {
          partner_subscription_id: updatedSubscription?.id || localSubscription.id,
          plan_id: plan.id,
          plan_name: plan.name,
          plan_tier: plan.tier,
          billing_cycle: billingCycle,
          trial_days: trialDays,
          trial_granted: canGrantTrial,
          payment_status: preapproval?.status || "pending",
          payment_url: preapproval?.init_point || planCheckoutUrl || null,
        },
      });

      return jsonResponse({
        success: true,
        subscription: updatedSubscription,
        status: finalStatus,
        paymentUrl: preapproval?.init_point || planCheckoutUrl || null,
      });
    } catch (mpError) {
      if (!planCheckoutUrl) {
        throw mpError;
      }

      console.warn("[CreatePartnerSubscription] Mercado Pago preapproval failed, using checkout fallback", {
        local_subscription_id: localSubscription.id,
        partner_id: partnerId,
        error: mpError instanceof Error ? mpError.message : String(mpError),
        fallback_url: planCheckoutUrl,
      });

      const { data: fallbackSubscription, error: fallbackError } = await supabase
        .from("partner_subscriptions")
        .update({
          status: "pending",
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
        throw new HttpError(500, `PARTNER_SUBSCRIPTION_FALLBACK_UPDATE_FAILED: ${fallbackError.message}`);
      }

      console.log("[CreatePartnerSubscription] Local partner subscription updated with checkout fallback", {
        local_subscription_id: fallbackSubscription?.id || localSubscription.id,
        partner_id: partnerId,
        fallback_url: planCheckoutUrl,
      });

      await updatePartnerProfileSubscription(supabase, partnerId, {
        subscription_plan_tier: String(plan.tier || "starter"),
        subscription_plan_status: "pending",
        subscription_plan_started_at: null,
        subscription_plan_expires_at: localSubscription.trial_ends_at || null,
        subscription_plan_metadata: {
          partner_subscription_id: fallbackSubscription?.id || localSubscription.id,
          plan_id: plan.id,
          plan_name: plan.name,
          plan_tier: plan.tier,
          billing_cycle: billingCycle,
          trial_days: trialDays,
          trial_granted: canGrantTrial,
          payment_status: "pending",
          payment_url: planCheckoutUrl,
          fallback: true,
        },
      });

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

    return jsonResponse({
      success: false,
      error: message,
      durationMs: Date.now() - startedAt,
    }, status);
  }
});
