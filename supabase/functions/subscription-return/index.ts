import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MOBILE_APP_SCHEME = "dogcatify";
const SUBSCRIPTION_SCOPES = ["user", "partner"] as const;

type SubscriptionScope = typeof SUBSCRIPTION_SCOPES[number];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeScope = (value?: string | null): SubscriptionScope => {
  const normalized = String(value || "").toLowerCase();
  return normalized === "partner" ? "partner" : "user";
};

const buildDeepLink = (subscriptionId: string | null, scope: SubscriptionScope = "user", target?: string | null) => {
  const fallbackTarget = scope === "partner"
    ? `${MOBILE_APP_SCHEME}://partner/subscription`
    : `${MOBILE_APP_SCHEME}://profile/subscription`;

  const url = new URL(target || fallbackTarget);
  if (subscriptionId) {
    url.searchParams.set("subscription_id", subscriptionId);
  }
  return url.toString();
};

const redirectResponse = (deepLink: string) => {
  const headers = new Headers(corsHeaders);
  headers.set("location", deepLink);
  headers.set("cache-control", "no-store");

  return new Response("Redirecting to DogCatiFy", {
    status: 302,
    headers,
  });
};

const getAdminMercadoPagoConfig = async (supabase: any) => {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "mercadopago_config")
    .maybeSingle();

  if (error) {
    throw new Error(`MP_CONFIG_READ_FAILED: ${error.message}`);
  }

  const config = data?.value || {};
  if (!config.access_token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN_REQUIRED");
  }

  return config;
};

const buildExternalReferenceCandidates = (subscriptionId: string, scope: SubscriptionScope) => {
  if (scope === "partner") {
    return [`partner:${subscriptionId}`];
  }

  return [`user:${subscriptionId}`, subscriptionId];
};

const fetchMercadoPagoOptional = async (accessToken: string, path: string) => {
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn("Mercado Pago return fetch failed:", {
        path,
        status: response.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("Mercado Pago return fetch error:", {
      path,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

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
  scope: SubscriptionScope = "user",
) => {
  const preapprovalId = String(subscription?.mercadopago_preapproval_id || "").trim();
  if (preapprovalId) {
    const preapproval = await fetchMercadoPagoOptional(accessToken, `/preapproval/${preapprovalId}`);
    if (preapproval) return preapproval;
  }

  const externalReference = String(subscription?.id || "").trim();
  if (externalReference) {
    const referenceCandidates = buildExternalReferenceCandidates(externalReference, scope);

    for (const candidate of referenceCandidates) {
      const query = new URLSearchParams({ external_reference: candidate });
      const search = await fetchMercadoPagoOptional(accessToken, `/preapproval/search?${query.toString()}`);
      const match = getSearchResults(search).find((item: any) =>
        String(item?.external_reference || "") === candidate
      );
      if (match) return match;
    }
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

const syncUserSubscription = async (supabase: any, subscriptionId: string) => {
  const { data: subscription, error } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error || !subscription) {
    console.warn("Subscription return could not load local subscription:", {
      subscriptionId,
      error: error?.message,
    });
    return false;
  }

  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  const preapproval = await findMercadoPagoPreapprovalForSubscription(mpConfig.access_token, subscription, "user");

  if (!preapproval) {
    console.warn("Subscription return could not find Mercado Pago preapproval:", {
      subscriptionId,
    });
    return false;
  }

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
      last_return_sync: {
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

  const { error: updateError } = await supabase
    .from("user_subscriptions")
    .update(updatePayload)
    .eq("id", subscription.id);

  if (updateError) {
    console.warn("Subscription return sync update failed:", {
      subscriptionId,
      error: updateError.message,
    });
    return false;
  }

  console.log("Subscription return synced local subscription:", {
    subscriptionId,
    preapprovalId: preapproval?.id,
    mpStatus: preapproval?.status,
    localStatus: mappedStatus,
  });
  return true;
};

const syncPartnerSubscription = async (supabase: any, subscriptionId: string) => {
  const { data: subscription, error } = await supabase
    .from("partner_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error || !subscription) {
    console.warn("Partner subscription return could not load local subscription:", {
      subscriptionId,
      error: error?.message,
    });
    return false;
  }

  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  const preapproval = await findMercadoPagoPreapprovalForSubscription(mpConfig.access_token, subscription, "partner");

  if (!preapproval) {
    console.warn("Partner subscription return could not find Mercado Pago preapproval:", {
      subscriptionId,
    });
    return false;
  }

  const now = new Date().toISOString();
  const mappedStatus = mapPreapprovalStatus(preapproval?.status);
  const updatePayload: Record<string, unknown> = {
    status: mappedStatus === "active" && subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > Date.now()
      ? "trialing"
      : mappedStatus,
    crm_subscription_id: preapproval?.id || subscription.crm_subscription_id || null,
    mercadopago_preapproval_id: preapproval?.id || subscription.mercadopago_preapproval_id || null,
    mercadopago_preapproval_plan_id: preapproval?.preapproval_plan_id || subscription.mercadopago_preapproval_plan_id || null,
    mercadopago_status: preapproval?.status || subscription.mercadopago_status || "pending",
    payment_url: preapproval?.init_point || subscription.payment_url || null,
    last_synced_at: now,
    metadata: {
      ...(subscription.metadata || {}),
      mp_preapproval: preapproval,
      last_return_sync: {
        synced_at: now,
      },
    },
    updated_at: now,
  };

  if (updatePayload.status === "trialing" && !subscription.started_at) {
    updatePayload.started_at = preapproval?.date_created || now;
  } else if (!subscription.started_at) {
    updatePayload.started_at = preapproval?.date_created || now;
  }

  if (preapproval?.next_payment_date) {
    updatePayload.expires_at = preapproval.next_payment_date;
  } else if (subscription.trial_ends_at) {
    updatePayload.expires_at = subscription.trial_ends_at;
  }

  const { error: updateError } = await supabase
    .from("partner_subscriptions")
    .update(updatePayload)
    .eq("id", subscription.id);

  if (updateError) {
    console.warn("Partner subscription return sync update failed:", {
      subscriptionId,
      error: updateError.message,
    });
    return false;
  }

  console.log("Partner subscription return synced local subscription:", {
    subscriptionId,
    preapprovalId: preapproval?.id,
    mpStatus: preapproval?.status,
    localStatus: mappedStatus,
  });

  const { error: partnerUpdateError } = await supabase
    .from("partners")
    .update({
      subscription_plan_tier: String(subscription.metadata?.plan_tier || "starter"),
      subscription_plan_status: String(updatePayload.status || mappedStatus),
      subscription_plan_started_at: String(updatePayload.started_at || subscription.started_at || now),
      subscription_plan_expires_at: updatePayload.expires_at || null,
      subscription_plan_metadata: {
        ...(subscription.metadata || {}),
        mp_preapproval: preapproval,
        last_return_sync: {
          synced_at: now,
        },
      },
      updated_at: now,
    })
    .eq("id", String(subscription.partner_id || ""));

  if (partnerUpdateError) {
    console.warn("Partner subscription return partner sync failed:", {
      subscriptionId,
      error: partnerUpdateError.message,
    });
  }
  return true;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const externalReference = String(url.searchParams.get("external_reference") || "");
  const subscriptionIdParam = String(url.searchParams.get("subscription_id") || "");
  const scope = normalizeScope(url.searchParams.get("scope") || (externalReference.startsWith("partner:") ? "partner" : "user"));
  const target = String(url.searchParams.get("target") || "").trim() || null;
  const rawSubscriptionId = subscriptionIdParam || externalReference || null;
  const subscriptionId = isUuid(subscriptionIdParam)
    ? subscriptionIdParam
    : isUuid(externalReference)
      ? externalReference
      : null;
  const deepLink = buildDeepLink(rawSubscriptionId, scope, target);

  try {
    if (subscriptionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
        if (scope === "partner") {
          await syncPartnerSubscription(supabase, subscriptionId);
        } else {
          await syncUserSubscription(supabase, subscriptionId);
        }
      }
    }
  } catch (error) {
    console.error("subscription-return sync failed:", error);
  }

  return redirectResponse(deepLink);
});
