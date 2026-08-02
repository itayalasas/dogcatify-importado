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
type SubscriptionReturnSyncResult = {
  success: boolean;
  localStatus: string | null;
  mpStatus: string | null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isValidDate = (value?: string | null) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const normalizeScope = (value?: string | null): SubscriptionScope => {
  const normalized = String(value || "").toLowerCase();
  return normalized === "partner" ? "partner" : "user";
};

const normalizeReturnStatus = (status?: string | null) => {
  const normalized = String(status || "").toLowerCase();

  switch (normalized) {
    case "authorized":
    case "approved":
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "in_process":
    case "pending":
    case "pending_review":
      return "pending";
    case "paused":
      return "paused";
    case "cancelled":
    case "canceled":
    case "rejected":
      return "cancelled";
    case "expired":
      return "expired";
    case "past_due":
      return "past_due";
    default:
      return "unknown";
  }
};

type SubscriptionReturnPathParams = {
  scope: SubscriptionScope | null;
  subscriptionId: string | null;
  partnerId: string | null;
};

const parseReturnPathParams = (pathname: string): SubscriptionReturnPathParams => {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);

  const functionIndex = segments.lastIndexOf("subscription-return");
  if (functionIndex < 0) {
    return { scope: null, subscriptionId: null, partnerId: null };
  }

  const tail = segments.slice(functionIndex + 1);
  const first = String(tail[0] || "").toLowerCase();

  if (first === "partner") {
    return {
      scope: "partner",
      partnerId: tail[1] ? String(tail[1]) : null,
      subscriptionId: tail[2] ? String(tail[2]) : tail[1] ? String(tail[1]) : null,
    };
  }

  if (first === "user") {
    return {
      scope: "user",
      partnerId: null,
      subscriptionId: tail[1] ? String(tail[1]) : null,
    };
  }

  return {
    scope: null,
    partnerId: null,
    subscriptionId: tail[0] ? String(tail[0]) : null,
  };
};

const buildDeepLink = (
  subscriptionId: string | null,
  scope: SubscriptionScope = "user",
  target?: string | null,
  extraParams: Record<string, string | null | undefined> = {},
) => {
  const fallbackTarget = scope === "partner"
    ? `${MOBILE_APP_SCHEME}://partner/subscription`
    : `${MOBILE_APP_SCHEME}://profile/subscription`;

  const url = new URL(target || fallbackTarget);
  if (subscriptionId) {
    url.searchParams.set("subscription_id", subscriptionId);
  }
  url.searchParams.set("subscription_scope", scope);

  Object.entries(extraParams).forEach(([key, value]) => {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;

    if (key === "partner_id" || key === "business_id") {
      url.searchParams.set("businessId", cleanValue);
      return;
    }

    url.searchParams.set(key, cleanValue);
  });

  return url.toString();
};

const buildReturnMessage = (
  scope: SubscriptionScope,
  localStatus: string | null,
  mpStatus: string | null,
  synced: boolean,
) => {
  const normalizedStatus = normalizeReturnStatus(localStatus || mpStatus);
  const subject = scope === "partner" ? "tu suscripcion de aliado" : "tu suscripcion";

  if (!synced && normalizedStatus === "unknown") {
    return `Estamos confirmando ${subject}. Si el estado no se refleja todavia, refresca en unos segundos.`;
  }

  switch (normalizedStatus) {
    case "active":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} quedo activa correctamente.`;
    case "trialing":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} quedo en periodo de prueba.`;
    case "pending":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} quedo pendiente de confirmacion en Mercado Pago.`;
    case "paused":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} quedo pausada.`;
    case "cancelled":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} quedo cancelada.`;
    case "expired":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} vencio. Debes renovarla para seguir usando el plan.`;
    case "past_due":
      return `Tu suscripcion${scope === "partner" ? " de aliado" : ""} tiene un pago pendiente.`;
    default:
      return `Estamos confirmando el estado de ${subject}.`;
  }
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
    case "approved":
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

type SubscriptionReferenceInfo = {
  scope: SubscriptionScope;
  id: string;
  raw: string;
  prefix: string | null;
};

const getSubscriptionReferenceInfo = (externalReference: string): SubscriptionReferenceInfo => {
  const raw = String(externalReference || "").trim();

  if (!raw) {
    return { scope: "user", id: "", raw: "", prefix: null };
  }

  const [prefixCandidate, ...rest] = raw.split(":");
  if (rest.length > 0) {
    const prefix = String(prefixCandidate || "").trim().toLowerCase();
    const id = rest.join(":").trim();

    if (prefix === "partner" || prefix === "user") {
      return {
        scope: prefix as SubscriptionScope,
        id,
        raw,
        prefix,
      };
    }
  }

  return {
    scope: "user",
    id: raw,
    raw,
    prefix: null,
  };
};

type PlanReferenceInfo = {
  planId: string | null;
  cycle: string | null;
  raw: string;
};

const getPlanReferenceInfo = (externalReference: string): PlanReferenceInfo => {
  const raw = String(externalReference || "").trim();
  if (!raw) {
    return { planId: null, cycle: null, raw: "" };
  }

  const parts = raw.split(":").map((part) => String(part || "").trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const second = parts[1].toLowerCase();
    if (second === "monthly" || second === "yearly") {
      return {
        planId: first,
        cycle: second,
        raw,
      };
    }
  }

  return { planId: null, cycle: null, raw };
};

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findMercadoPagoPreapprovalWithRetry = async (
  accessToken: string,
  subscription: any,
  scope: SubscriptionScope = "user",
  attempts = 5,
  delayMs = 1200,
) => {
  let lastPreapproval: any = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const preapproval = await findMercadoPagoPreapprovalForSubscription(accessToken, subscription, scope);
    lastPreapproval = preapproval;

    if (!preapproval) {
      if (attempt < attempts - 1) {
        await sleep(delayMs);
      }
      continue;
    }

    const status = String(preapproval?.status || "").toLowerCase();
    if (status !== "pending") {
      return preapproval;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return lastPreapproval;
};

const findLocalSubscriptionFromPreapproval = async (
  supabase: any,
  preapproval: any,
  scope: SubscriptionScope,
) => {
  const table = scope === "partner" ? "partner_subscriptions" : "user_subscriptions";
  const preapprovalId = String(preapproval?.id || "").trim();
  const externalReference = String(preapproval?.external_reference || "").trim();
  const mpPlanId = String(preapproval?.preapproval_plan_id || "").trim();
  const payerEmail = getPreapprovalPayerEmail(preapproval);
  const referenceInfo = getSubscriptionReferenceInfo(externalReference);
  const planReferenceInfo = getPlanReferenceInfo(externalReference);

  console.log(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Resolving local subscription from preapproval`, {
    table,
    preapprovalId: preapprovalId || null,
    externalReference: externalReference || null,
    mpPlanId: mpPlanId || null,
    payerEmail: payerEmail || null,
    referenceScope: referenceInfo.scope,
    referenceId: referenceInfo.id || null,
    planReference: planReferenceInfo,
  });

  if (preapprovalId) {
    const { data: byPreapprovalId, error } = await supabase
      .from(table)
      .select("*")
      .eq("mercadopago_preapproval_id", preapprovalId)
      .maybeSingle();

    if (error) {
      console.warn(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Local lookup by preapproval id failed`, {
        preapprovalId,
        error: error.message,
      });
    }

    if (byPreapprovalId) {
      console.log(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Matched local subscription by MP preapproval id`, {
        localSubscriptionId: byPreapprovalId.id,
        preapprovalId,
      });
      return byPreapprovalId;
    }
  }

  if (referenceInfo.id && isUuid(referenceInfo.id)) {
    const { data: byExternalReference, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", referenceInfo.id)
      .maybeSingle();

    if (error) {
      console.warn(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Local lookup by external reference failed`, {
        referenceId: referenceInfo.id,
        error: error.message,
      });
    }

    if (byExternalReference) {
      console.log(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Matched local subscription by external reference`, {
        localSubscriptionId: byExternalReference.id,
        referenceId: referenceInfo.id,
      });
      return byExternalReference;
    }
  }

  if (payerEmail && mpPlanId) {
    const { data: byPayerAndPlan, error } = await supabase
      .from(table)
      .select("*")
      .eq("mercadopago_preapproval_plan_id", mpPlanId)
      .contains("metadata", { payer_email: payerEmail })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Local lookup by payer/plan failed`, {
        mpPlanId,
        payerEmail,
        error: error.message,
      });
    }

    if (byPayerAndPlan) {
      console.log(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Matched local subscription by payer and plan`, {
        localSubscriptionId: byPayerAndPlan.id,
        mpPlanId,
        payerEmail,
      });
      return byPayerAndPlan;
    }
  }

  if (planReferenceInfo.planId) {
    let query = supabase
      .from(table)
      .select("*")
      .eq("plan_id", planReferenceInfo.planId)
      .order("created_at", { ascending: false });

    if (planReferenceInfo.cycle) {
      query = query.eq("billing_cycle", planReferenceInfo.cycle);
    }

    const { data: byPlanReference, error } = await query
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Local lookup by plan reference failed`, {
        planId: planReferenceInfo.planId,
        cycle: planReferenceInfo.cycle,
        error: error.message,
      });
    }

    if (byPlanReference) {
      console.log(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Matched local subscription by plan reference`, {
        localSubscriptionId: byPlanReference.id,
        planId: planReferenceInfo.planId,
        cycle: planReferenceInfo.cycle,
      });
      return byPlanReference;
    }
  }

  console.warn(`[SubscriptionReturn][${scope === "partner" ? "Partner" : "User"}] Could not resolve local subscription from preapproval`, {
    preapprovalId: preapprovalId || null,
    externalReference: externalReference || null,
    mpPlanId: mpPlanId || null,
    payerEmail: payerEmail || null,
    planReference: planReferenceInfo,
  });

  return null;
};

const syncUserSubscription = async (supabase: any, subscriptionId: string): Promise<SubscriptionReturnSyncResult> => {
  const { data: initialSubscription, error } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  let subscription = initialSubscription;
  let preapproval: any = null;

  if (error || !subscription) {
    console.warn("[SubscriptionReturn][User] Could not load local subscription by id, trying preapproval fallback", {
      subscriptionId,
      error: error?.message || null,
    });

    const mpConfig = await getAdminMercadoPagoConfig(supabase);
    preapproval = await fetchMercadoPagoOptional(mpConfig.access_token, `/preapproval/${subscriptionId}`);

    if (!preapproval) {
      console.warn("[SubscriptionReturn][User] Could not resolve preapproval fallback", {
        subscriptionId,
      });
      return { success: false, localStatus: initialSubscription?.status || null, mpStatus: null };
    }

    console.log("[SubscriptionReturn][User] Preapproval fallback resolved", {
      subscriptionId,
      preapprovalId: preapproval?.id || null,
      mpStatus: preapproval?.status || null,
      externalReference: preapproval?.external_reference || null,
    });

    subscription = await findLocalSubscriptionFromPreapproval(supabase, preapproval, "user");

    if (!subscription) {
      return { success: false, localStatus: null, mpStatus: preapproval?.status || null };
    }
  }

  console.log("[SubscriptionReturn][User] Loaded local subscription", {
    subscriptionId,
    userId: subscription.user_id || null,
    status: subscription.status || null,
    mpPreapprovalId: subscription.mercadopago_preapproval_id || null,
    mpPlanId: subscription.mercadopago_preapproval_plan_id || null,
  });

  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  if (!preapproval) {
    preapproval = await findMercadoPagoPreapprovalWithRetry(mpConfig.access_token, subscription, "user");
  }

  if (!preapproval) {
    console.warn("Subscription return could not find Mercado Pago preapproval:", {
      subscriptionId,
    });
    return { success: false, localStatus: subscription?.status || null, mpStatus: null };
  }

  console.log("[SubscriptionReturn][User] Mercado Pago preapproval resolved", {
    subscriptionId,
    preapprovalId: preapproval?.id || null,
    mpStatus: preapproval?.status || null,
    externalReference: preapproval?.external_reference || null,
  });

  const now = new Date().toISOString();
  const mappedStatus = mapPreapprovalStatus(preapproval?.status);
  const trialEndsAt = isValidDate(subscription?.trial_ends_at) ? String(subscription.trial_ends_at) : null;
  const effectiveStatus = subscription.trial_used && trialEndsAt && new Date(trialEndsAt).getTime() > Date.now() && mappedStatus === "active"
    ? "trialing"
    : mappedStatus;
  const updatePayload: Record<string, unknown> = {
    status: effectiveStatus,
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

  if (effectiveStatus === "trialing" && !subscription.started_at) {
    updatePayload.started_at = subscription.trial_started_at || preapproval?.date_created || now;
  } else if (mappedStatus === "active" && !subscription.started_at) {
    updatePayload.started_at = preapproval?.date_created || now;
  }

  if (preapproval?.next_payment_date) {
    updatePayload.expires_at = preapproval.next_payment_date;
  } else if (trialEndsAt) {
    updatePayload.expires_at = trialEndsAt;
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
    return { success: false, localStatus: effectiveStatus, mpStatus: preapproval?.status || null };
  }

  console.log("[SubscriptionReturn][User] Synced local subscription", {
    subscriptionId,
    preapprovalId: preapproval?.id,
    mpStatus: preapproval?.status,
    localStatus: effectiveStatus,
  });
  return { success: true, localStatus: effectiveStatus, mpStatus: preapproval?.status || null };
};

const syncPartnerSubscription = async (supabase: any, subscriptionId: string): Promise<SubscriptionReturnSyncResult> => {
  const { data: initialSubscription, error } = await supabase
    .from("partner_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  let subscription = initialSubscription;
  let preapproval: any = null;

  if (error || !subscription) {
    console.warn("[SubscriptionReturn][Partner] Could not load local subscription by id, trying preapproval fallback", {
      subscriptionId,
      error: error?.message || null,
    });

    const mpConfig = await getAdminMercadoPagoConfig(supabase);
    preapproval = await fetchMercadoPagoOptional(mpConfig.access_token, `/preapproval/${subscriptionId}`);

    if (!preapproval) {
      console.warn("[SubscriptionReturn][Partner] Could not resolve preapproval fallback", {
        subscriptionId,
      });
      return { success: false, localStatus: initialSubscription?.status || null, mpStatus: null };
    }

    console.log("[SubscriptionReturn][Partner] Preapproval fallback resolved", {
      subscriptionId,
      preapprovalId: preapproval?.id || null,
      mpStatus: preapproval?.status || null,
      externalReference: preapproval?.external_reference || null,
    });

    subscription = await findLocalSubscriptionFromPreapproval(supabase, preapproval, "partner");

    if (!subscription) {
      return { success: false, localStatus: null, mpStatus: preapproval?.status || null };
    }
  }

  console.log("[SubscriptionReturn][Partner] Loaded local subscription", {
    subscriptionId,
    partnerId: subscription.partner_id || null,
    status: subscription.status || null,
    mpPreapprovalId: subscription.mercadopago_preapproval_id || null,
    mpPlanId: subscription.mercadopago_preapproval_plan_id || null,
  });

  const mpConfig = await getAdminMercadoPagoConfig(supabase);
  if (!preapproval) {
    preapproval = await findMercadoPagoPreapprovalWithRetry(mpConfig.access_token, subscription, "partner");
  }

  if (!preapproval) {
    console.warn("Partner subscription return could not find Mercado Pago preapproval:", {
      subscriptionId,
    });
    return { success: false, localStatus: subscription?.status || null, mpStatus: null };
  }

  console.log("[SubscriptionReturn][Partner] Mercado Pago preapproval resolved", {
    subscriptionId,
    preapprovalId: preapproval?.id || null,
    mpStatus: preapproval?.status || null,
    externalReference: preapproval?.external_reference || null,
  });

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
    return { success: false, localStatus: String(updatePayload.status || mappedStatus), mpStatus: preapproval?.status || null };
  }

  console.log("[SubscriptionReturn][Partner] Synced local subscription", {
    subscriptionId,
    preapprovalId: preapproval?.id,
    mpStatus: preapproval?.status,
    localStatus: mappedStatus,
  });

  const { data: partnerOwnerRow, error: partnerOwnerError } = await supabase
    .from("partners")
    .select("user_id")
    .eq("id", String(subscription.partner_id || ""))
    .maybeSingle();

  if (partnerOwnerError) {
    console.warn("Partner subscription return partner owner lookup failed:", {
      subscriptionId,
      error: partnerOwnerError.message,
    });
  } else if (partnerOwnerRow?.user_id) {
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
      .eq("user_id", partnerOwnerRow.user_id);

    if (partnerUpdateError) {
      console.warn("Partner subscription return partner sync failed:", {
        subscriptionId,
        error: partnerUpdateError.message,
      });
    }
  }
  return { success: true, localStatus: String(updatePayload.status || mappedStatus), mpStatus: preapproval?.status || null };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParams = parseReturnPathParams(url.pathname);
  const externalReference = String(url.searchParams.get("external_reference") || "");
  const subscriptionIdParam = String(url.searchParams.get("subscription_id") || "");
  const preapprovalIdParam = String(url.searchParams.get("preapproval_id") || "");
  const scope = normalizeScope(
    url.searchParams.get("scope") ||
      pathParams.scope ||
      (externalReference.startsWith("partner:") ? "partner" : "user"),
  );
  const target = String(url.searchParams.get("target") || "").trim() || null;
  const partnerId = String(url.searchParams.get("business_id") || pathParams.partnerId || "").trim() || null;
  const rawSubscriptionId = subscriptionIdParam || pathParams.subscriptionId || externalReference || null;
  const subscriptionId = isUuid(subscriptionIdParam)
    ? subscriptionIdParam
    : isUuid(pathParams.subscriptionId || "")
      ? String(pathParams.subscriptionId)
    : isUuid(externalReference)
      ? externalReference
      : null;
  const syncReferenceId = subscriptionId || preapprovalIdParam || null;
  let syncResult: SubscriptionReturnSyncResult | null = null;

  console.log("[SubscriptionReturn] Incoming return request", {
    url: url.toString(),
    pathname: url.pathname,
    external_reference: externalReference || null,
    subscription_id_param: subscriptionIdParam || null,
    preapproval_id_param: preapprovalIdParam || null,
    path_params: pathParams,
    scope,
    target,
    partner_id: partnerId,
    resolved_subscription_id: subscriptionId,
    sync_reference_id: syncReferenceId,
  });

  try {
    if (syncReferenceId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        if (scope === "partner") {
          syncResult = await syncPartnerSubscription(supabase, syncReferenceId);
        } else {
          syncResult = await syncUserSubscription(supabase, syncReferenceId);
        }
      }
    }
  } catch (error) {
    console.error("subscription-return sync failed:", error);
  }

  const resolvedStatus = syncResult?.localStatus || syncResult?.mpStatus || "unknown";
  const subscriptionMessage = buildReturnMessage(
    scope,
    syncResult?.localStatus || null,
    syncResult?.mpStatus || null,
    Boolean(syncResult?.success),
  );
  const deepLink = buildDeepLink(rawSubscriptionId, scope, target, {
    partner_id: partnerId,
    subscription_status: resolvedStatus,
    subscription_message: subscriptionMessage,
  });

  return redirectResponse(deepLink);
});
