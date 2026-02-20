import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ApprovalRequestBody = {
  promotionId?: string;
  relationType?: "service" | "product" | "partner";
  relationId?: string;
  relationName?: string;
  requestedBy?: string;
  billing?: {
    costPerLike?: number;
    costPerView?: number;
    costPerClick?: number;
    currency?: string;
  };
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateTime = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const isSchemaCacheError = (message?: string) => {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('schema cache') ||
    text.includes('could not find') ||
    text.includes('column') ||
    text.includes('does not exist')
  );
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ApprovalRequestBody = await req.json();

    const promotionId = body?.promotionId;
    if (!promotionId) {
      throw new Error("promotionId es requerido");
    }

    let { data: promotion, error: promotionError } = await supabase
      .from("promotions")
      .select("id, title, description, start_date, end_date, partner_id, cost_per_like, cost_per_view, cost_per_click")
      .eq("id", promotionId)
      .maybeSingle();

    if (promotionError && isSchemaCacheError(promotionError.message)) {
      const fallback = await supabase
        .from("promotions")
        .select("id, title, description, start_date, end_date, partner_id")
        .eq("id", promotionId)
        .maybeSingle();

      promotion = fallback.data as any;
      promotionError = fallback.error as any;
    }

    if (promotionError) {
      throw new Error(`PROMOTION_READ_FAILED: ${promotionError.message}`);
    }

    if (!promotion) {
      throw new Error("PROMOTION_NOT_FOUND");
    }

    const partnerId = promotion.partner_id;
    if (!partnerId) {
      throw new Error("PROMOTION_PARTNER_REQUIRED: La promoción debe tener partner_id");
    }

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, business_name, email")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError) {
      throw new Error(`PARTNER_READ_FAILED: ${partnerError.message}`);
    }

    if (!partner?.email) {
      throw new Error("PARTNER_EMAIL_REQUIRED: El partner no tiene email configurado");
    }

    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: cancelPendingError } = await supabase
      .from("promotion_approval_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("promotion_id", promotionId)
      .eq("status", "pending");

    if (cancelPendingError && isSchemaCacheError(cancelPendingError.message)) {
      throw new Error(
        "APPROVAL_SCHEMA_MISSING: Falta la tabla/campos de promotion_approval_requests. Ejecuta migraciones de workflow de aprobación."
      );
    }

    const resolvedCostPerLike = toNumberOrNull(body.billing?.costPerLike) ?? Number((promotion as any).cost_per_like ?? 0);
    const resolvedCostPerView = toNumberOrNull(body.billing?.costPerView) ?? Number((promotion as any).cost_per_view ?? 0);
    const resolvedCostPerClick = toNumberOrNull(body.billing?.costPerClick) ?? Number((promotion as any).cost_per_click ?? 0);
    const requestedAtIso = new Date().toISOString();

    const payloadPreview = {
      request_id: "PENDING_DB_ID",
      promotion_id: promotion.id,
      promotion_title: promotion.title,
      promotion_description: promotion.description,
      partner: {
        id: partner.id,
        business_name: partner.business_name,
        email: partner.email,
      },
      relation: {
        type: body.relationType || "partner",
        id: body.relationId || partner.id,
        name: body.relationName || partner.business_name,
      },
      billing: {
        currency: body.billing?.currency || "UYU",
        cost_per_like: resolvedCostPerLike,
        cost_per_view: resolvedCostPerView,
        cost_per_click: resolvedCostPerClick,
      },
      schedule: {
        start_date: new Date(promotion.start_date).toISOString().slice(0, 10),
        end_date: new Date(promotion.end_date).toISOString().slice(0, 10),
      },
      actions: {
        accept_url: `${supabaseUrl}/functions/v1/promotion-approval-action?action=accept&token=${token}`,
        cancel_url: `${supabaseUrl}/functions/v1/promotion-approval-action?action=cancel&token=${token}`,
      },
      meta: {
        requested_by_user_id: body.requestedBy || null,
        requested_at: formatDateTime(requestedAtIso),
        expires_at: formatDateTime(expiresAt),
        requested_at_iso: requestedAtIso,
        expires_at_iso: expiresAt,
      },
    };

    const { data: requestRow, error: requestInsertError } = await supabase
      .from("promotion_approval_requests")
      .insert({
        promotion_id: promotion.id,
        partner_id: partner.id,
        partner_email: partner.email,
        status: "pending",
        token_hash: tokenHash,
        action_token_expires_at: expiresAt,
        requested_payload: payloadPreview,
        requested_by: body.requestedBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (requestInsertError) {
      if (isSchemaCacheError(requestInsertError.message)) {
        throw new Error(
          "APPROVAL_SCHEMA_MISSING: No se pudo guardar request de aprobación (tabla/campos faltantes). Ejecuta migraciones pendientes."
        );
      }
      throw new Error(`APPROVAL_REQUEST_CREATE_FAILED: ${requestInsertError.message}`);
    }

    payloadPreview.request_id = requestRow.id;

    const emailPayload = {
      template_name: "promotion_approval_request",
      recipient_email: partner.email,
      data: payloadPreview,
    };

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify(emailPayload),
    });

    const emailResponseText = await emailResponse.text();

    if (!emailResponse.ok) {
      throw new Error(`APPROVAL_EMAIL_FAILED (${emailResponse.status}): ${emailResponseText}`);
    }

    const { error: promotionUpdateError } = await supabase
      .from("promotions")
      .update({
        approval_status: "pending",
        approval_requested_at: new Date().toISOString(),
        approval_decision_at: null,
        approval_decision_reason: null,
        is_active: false,
      })
      .eq("id", promotion.id);

    if (promotionUpdateError) {
      if (!isSchemaCacheError(promotionUpdateError.message)) {
        throw new Error(`PROMOTION_APPROVAL_STATUS_UPDATE_FAILED: ${promotionUpdateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Solicitud de aprobación enviada al partner",
        requestId: requestRow.id,
        payloadPreview,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-promotion-approval-request:", error);

    const errorMessage = String(error?.message || "Failed to send promotion approval request");
    const statusCode = errorMessage.includes('APPROVAL_SCHEMA_MISSING') ? 409 : 500;

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
