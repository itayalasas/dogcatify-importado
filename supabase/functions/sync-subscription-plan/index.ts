import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type BillingCycle = "monthly" | "yearly";
type SyncMode = "import" | "push";
type JsonBody = Record<string, any>;
type MercadoPagoCredentialMode = "test" | "production";

const MERCADOPAGO_TIMEOUT_MS = 15000;
const DEFAULT_PUBLIC_APP_URL = "https://app-dogcatify.netlify.app";
const FUNCTION_VERSION = "2026-04-26-sync-marker-v1";
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

const getTraceId = (req: Request, body?: JsonBody) =>
  req.headers.get("x-dogcatify-trace-id") ||
  req.headers.get("x-trace-id") ||
  body?.traceId ||
  crypto.randomUUID();

const logInfo = (traceId: string, message: string, data?: Record<string, unknown>) => {
};

const logError = (traceId: string, message: string, error: unknown, data?: Record<string, unknown>) => {
  const errorPayload = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { error };

};

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

const requireAdmin = async (supabase: any, req: Request) => {
  const user = await getAuthUser(supabase, req);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `PROFILE_READ_FAILED: ${error.message}`);
  }

  const isAdmin = profile?.is_admin === true;

  if (!isAdmin) {
    throw new HttpError(403, "ADMIN_REQUIRED");
  }

  return user;
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
  traceId: string,
) => {
  const startedAt = Date.now();
  const method = init.method || "GET";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MERCADOPAGO_TIMEOUT_MS);

  logInfo(traceId, "Mercado Pago request started", {
    method,
    path,
    timeoutMs: MERCADOPAGO_TIMEOUT_MS,
  });

  let response: Response;

  try {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    logError(traceId, "Mercado Pago request failed before response", error, {
      method,
      path,
      durationMs: Date.now() - startedAt,
      timedOut: isAbort,
    });

    if (isAbort) {
      throw new HttpError(504, `MERCADOPAGO_TIMEOUT: ${method} ${path}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

    logInfo(traceId, "Mercado Pago request returned error", {
      method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: typeof body === "string" ? body.slice(0, 500) : body,
    });

    throw new HttpError(response.status, `MERCADOPAGO_API_ERROR: ${message}`);
  }

  logInfo(traceId, "Mercado Pago request completed", {
    method,
    path,
    status: response.status,
    durationMs: Date.now() - startedAt,
    responseId: body?.id,
    responseStatus: body?.status,
  });

  return body;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cycleLabel = (cycle: BillingCycle) => cycle === "monthly" ? "Mensual" : "Anual";

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

const buildSubscriptionReturnUrl = () => {
  const supabaseUrl = normalizeHttpsBaseUrl(Deno.env.get("SUPABASE_URL"));
  if (supabaseUrl) {
    return new URL(SUBSCRIPTION_RETURN_FUNCTION_PATH, `${supabaseUrl}/`).toString();
  }

  return new URL("/subscription/return", `${getPublicAppBaseUrl()}/`).toString();
};

const getCycleFields = (cycle: BillingCycle) => ({
  planId: cycle === "monthly" ? "mercadopago_monthly_plan_id" : "mercadopago_yearly_plan_id",
  initPoint: cycle === "monthly" ? "mercadopago_monthly_init_point" : "mercadopago_yearly_init_point",
  status: cycle === "monthly" ? "mercadopago_monthly_status" : "mercadopago_yearly_status",
  price: cycle === "monthly" ? "price_monthly" : "price_yearly",
});

const buildPreapprovalPlanPayload = (plan: any, cycle: BillingCycle) => {
  const fields = getCycleFields(cycle);
  const amount = toNumber(plan[fields.price]);
  const currency = String(plan.currency || "UYU").toUpperCase();
  const trialDays = Math.max(0, Math.trunc(Number(plan.trial_days || 0)));

  const payload: Record<string, unknown> = {
    reason: `${plan.name} ${cycleLabel(cycle)}`.slice(0, 255),
    auto_recurring: {
      frequency: cycle === "monthly" ? 1 : 12,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: currency,
    },
    back_url: buildSubscriptionReturnUrl(),
    external_reference: `${plan.id}:${cycle}`,
  };

  if (trialDays > 0) {
    payload.auto_recurring = {
      ...(payload.auto_recurring as Record<string, unknown>),
      free_trial: {
        frequency: trialDays,
        frequency_type: "days",
      },
    };
  }

  return payload;
};

const compactPlanSnapshot = (remotePlan: any) => ({
  id: remotePlan?.id,
  status: remotePlan?.status,
  reason: remotePlan?.reason,
  init_point: remotePlan?.init_point,
  external_reference: remotePlan?.external_reference,
  auto_recurring: remotePlan?.auto_recurring,
  last_modified: remotePlan?.last_modified,
});

const syncCycle = async (
  accessToken: string,
  plan: any,
  cycle: BillingCycle,
  mode: SyncMode,
  traceId: string,
) => {
  const fields = getCycleFields(cycle);
  const existingMpPlanId = String(plan[fields.planId] || "").trim();
  const amount = toNumber(plan[fields.price]);

  logInfo(traceId, "Cycle sync started", {
    cycle,
    mode,
    amount,
    hasExistingMercadoPagoPlanId: !!existingMpPlanId,
    existingMpPlanId: existingMpPlanId || null,
  });

  if (!existingMpPlanId && amount <= 0) {
    logInfo(traceId, "Cycle sync skipped because it is free", {
      cycle,
      amount,
    });

    return {
      cycle,
      skipped: true,
      reason: "FREE_CYCLE",
    };
  }

  let remotePlan: any;
  let action = "imported";

  if (existingMpPlanId) {
    if (mode === "push") {
      remotePlan = await fetchMercadoPago(accessToken, `/preapproval_plan/${existingMpPlanId}`, {
        method: "PUT",
        body: JSON.stringify(buildPreapprovalPlanPayload(plan, cycle)),
      }, traceId);
      action = "updated";
    } else {
      remotePlan = await fetchMercadoPago(accessToken, `/preapproval_plan/${existingMpPlanId}`, {}, traceId);
      action = "imported";
    }
  } else {
    remotePlan = await fetchMercadoPago(accessToken, "/preapproval_plan", {
      method: "POST",
      body: JSON.stringify(buildPreapprovalPlanPayload(plan, cycle)),
    }, traceId);
    action = "created";
  }

  const remoteAmount = toNumber(remotePlan?.auto_recurring?.transaction_amount);
  const remoteCurrency = remotePlan?.auto_recurring?.currency_id;

  const result = {
    cycle,
    action,
    remotePlan,
    updates: {
      [fields.planId]: remotePlan?.id || existingMpPlanId,
      [fields.initPoint]: remotePlan?.init_point || null,
      [fields.status]: remotePlan?.status || null,
      ...(remoteAmount > 0 ? { [fields.price]: remoteAmount } : {}),
      ...(remoteCurrency ? { currency: String(remoteCurrency).toUpperCase() } : {}),
    },
  };

  logInfo(traceId, "Cycle sync completed", {
    cycle,
    action,
    mercadoPagoPlanId: remotePlan?.id,
    mercadoPagoStatus: remotePlan?.status,
    remoteAmount,
    remoteCurrency,
  });

  return result;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = Date.now();
  let traceId = req.headers.get("x-dogcatify-trace-id") || req.headers.get("x-trace-id") || crypto.randomUUID();
  let supabase: any = null;
  let planId = "";
  let mode: SyncMode = "import";
  let planLoaded = false;
  let planMetadata: Record<string, unknown> = {};

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new HttpError(500, "SUPABASE_ENV_REQUIRED");
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    traceId = getTraceId(req, body);

    planId = String(body?.planId || "").trim();
    mode = body?.mode === "push" ? "push" : "import";

    logInfo(traceId, "Request received", {
      method: req.method,
      planId,
      mode,
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const user = await requireAdmin(supabase, req);

    logInfo(traceId, "Admin authorization completed", {
      userId: user.id,
      email: user.email,
    });

    if (!planId) {
      throw new HttpError(400, "PLAN_ID_REQUIRED");
    }

    logInfo(traceId, "Loading local subscription plan", {
      planId,
    });

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

    planLoaded = true;
    planMetadata = plan.mercadopago_metadata && typeof plan.mercadopago_metadata === "object"
      ? plan.mercadopago_metadata
      : {};

    logInfo(traceId, "Local subscription plan loaded", {
      planId: plan.id,
      name: plan.name,
      currency: plan.currency,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      trialDays: plan.trial_days || 0,
      audienceTarget: plan.audience_target || null,
      monthlyMpPlanId: plan.mercadopago_monthly_plan_id || null,
      yearlyMpPlanId: plan.mercadopago_yearly_plan_id || null,
    });

    const mpConfig = await getAdminMercadoPagoConfig(supabase);

    logInfo(traceId, "Mercado Pago admin config loaded", {
      isConnected: mpConfig.is_connected ?? null,
      isTestMode: mpConfig.is_test_mode ?? null,
      hasAccessToken: !!mpConfig.access_token,
      credentialMode: mpConfig.credential_mode,
      expectedCredentialMode: mpConfig.expected_credential_mode,
      credentialModeMismatch: mpConfig.credential_mode_mismatch,
      publicKeyMode: mpConfig.public_key_mode,
      publicKeyInvalidFormat: mpConfig.public_key_invalid_format,
      publicKeyModeMismatch: mpConfig.public_key_mode_mismatch,
    });

    const monthlyResult = await syncCycle(mpConfig.access_token, plan, "monthly", mode, traceId);
    const planForYearly = {
      ...plan,
      ...((monthlyResult as any).updates || {}),
    };
    const yearlyResult = await syncCycle(mpConfig.access_token, planForYearly, "yearly", mode, traceId);

    const now = new Date().toISOString();
    const updates = {
      ...((monthlyResult as any).updates || {}),
      ...((yearlyResult as any).updates || {}),
      mercadopago_last_sync_at: now,
      mercadopago_sync_error: null,
      mercadopago_metadata: {
        ...(plan.mercadopago_metadata || {}),
        monthly: (monthlyResult as any).remotePlan ? compactPlanSnapshot((monthlyResult as any).remotePlan) : undefined,
        yearly: (yearlyResult as any).remotePlan ? compactPlanSnapshot((yearlyResult as any).remotePlan) : undefined,
        last_sync_mode: mode,
        last_sync_status: "synced",
        last_sync_success: true,
        last_sync_trace_id: traceId,
        last_sync_function_version: FUNCTION_VERSION,
        last_synced_at: now,
      },
      updated_at: now,
    };

    logInfo(traceId, "Updating local subscription plan with sync result", {
      planId,
      updatedFields: Object.keys(updates),
    });

    const { data: updatedPlan, error: updateError } = await supabase
      .from("subscription_plans")
      .update(updates)
      .eq("id", planId)
      .select("*")
      .single();

    if (updateError) {
      throw new HttpError(500, `PLAN_UPDATE_FAILED: ${updateError.message}`);
    }

    logInfo(traceId, "Sync completed successfully", {
      planId,
      durationMs: Date.now() - startedAt,
      monthlyAction: (monthlyResult as any).action,
      yearlyAction: (yearlyResult as any).action,
    });

    return jsonResponse({
      success: true,
      traceId,
      syncStatus: "synced",
      functionVersion: FUNCTION_VERSION,
      plan: updatedPlan,
      results: [monthlyResult, yearlyResult].map((result: any) => ({
        cycle: result.cycle,
        action: result.action,
        skipped: result.skipped,
        reason: result.reason,
        mercadoPagoPlanId: result.remotePlan?.id,
        status: result.remotePlan?.status,
        initPoint: result.remotePlan?.init_point,
      })),
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    logError(traceId, "Request failed", error, {
      status,
      durationMs: Date.now() - startedAt,
    });

    let markedPlanSyncFailure = false;
    if (supabase && planLoaded && planId) {
      const failedAt = new Date().toISOString();
      const syncError = message.slice(0, 1000);
      const { error: markError } = await supabase
        .from("subscription_plans")
        .update({
          mercadopago_last_sync_at: failedAt,
          mercadopago_sync_error: syncError,
          mercadopago_metadata: {
            ...planMetadata,
            last_sync_mode: mode,
            last_sync_status: "failed",
            last_sync_success: false,
            last_sync_trace_id: traceId,
            last_sync_function_version: FUNCTION_VERSION,
            last_sync_error: syncError,
            last_sync_failed_at: failedAt,
          },
          updated_at: failedAt,
        })
        .eq("id", planId);

      if (markError) {
        logError(traceId, "Failed to mark local subscription plan sync failure", markError, {
          planId,
        });
      } else {
        markedPlanSyncFailure = true;
      }
    }

    return jsonResponse({
      success: false,
      traceId,
      syncStatus: "failed",
      functionVersion: FUNCTION_VERSION,
      markedPlanSyncFailure,
      error: message,
    }, status);
  }
});
