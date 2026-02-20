import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type HtmlVariant = "success" | "danger" | "warning" | "info";

const DOGCATIFY_LOGO =
  "https://zkgiwamycbjcogcgqhff.supabase.co/storage/v1/object/public/dogcatify/system/logo-dogcatify-nuevo.png";

const escapeHtml = (s: string) =>
  (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// Plantilla HTML con estilo DogCatiFy (similar a tus mails)
const html = (title: string, message: string, variant: HtmlVariant = "info", extra?: string) => {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  const variantMap: Record<HtmlVariant, { header: string; boxBg: string; boxBorder: string; badgeBg: string; badgeText: string; badge: string }> = {
    success: { header: "#4B9991", boxBg: "#e6f4f2", boxBorder: "#4B9991", badgeBg: "#e6f4f2", badgeText: "#0f766e", badge: "OK" },
    info:    { header: "#4B9991", boxBg: "#eef6ff", boxBorder: "#60a5fa", badgeBg: "#eef6ff", badgeText: "#1d4ed8", badge: "INFO" },
    warning: { header: "#b45309", boxBg: "#fff7ed", boxBorder: "#fdba74", badgeBg: "#fff7ed", badgeText: "#7c2d12", badge: "ATENCIÓN" },
    danger:  { header: "#b91c1c", boxBg: "#fef2f2", boxBorder: "#fecaca", badgeBg: "#fef2f2", badgeText: "#991b1b", badge: "ERROR" },
  };

  const v = variantMap[variant];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | DogCatiFy</title>
  <style>
    @media screen and (max-width:620px){
      .container{width:100%!important;}
      .px{padding-left:16px!important; padding-right:16px!important;}
      .btn{display:block!important;text-align:center!important;}
    }
    body{margin:0;padding:0;background:#f5f7f9;font-family:Arial,Helvetica,sans-serif;}
    .muted{color:#6b7280}
    .btn{
      display:inline-block;text-decoration:none;background:#4B9991;color:#fff !important;
      padding:12px 18px;border-radius:6px;font-weight:700
    }
    .btn-secondary{
      display:inline-block;text-decoration:none;background:#0f172a;color:#fff !important;
      padding:12px 18px;border-radius:6px;font-weight:700
    }
  </style>
</head>

<body>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7f9;">
    <tr>
      <td align="center" style="padding:30px 14px;">
        <table class="container" width="640" cellpadding="0" cellspacing="0" border="0"
               style="width:640px;max-width:640px;background:#ffffff;border-radius:6px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${v.header};padding:20px 30px;text-align:center;color:#fff;">
              <img src="${DOGCATIFY_LOGO}" alt="DogCatiFy" width="120" style="display:block;margin:0 auto 10px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;">${safeTitle}</h1>
              <p style="margin:8px 0 0;font-size:14px;opacity:.95;">
                <span style="display:inline-block;background:${v.badgeBg};color:${v.badgeText};
                             padding:4px 10px;border-radius:999px;font-weight:700;font-size:12px;">
                  ${v.badge}
                </span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="px" style="padding:26px 30px;">
              <p style="font-size:16px;color:#334155;margin:0 0 18px;line-height:1.5;">
                ${safeMessage}
              </p>

              <!-- Caja clave -->
              <div style="background:${v.boxBg};border:1px solid ${v.boxBorder};border-radius:6px;padding:14px 16px;margin-bottom:18px;">
                <p style="margin:0;font-size:14px;color:#0f172a;font-weight:700;">Detalle</p>
                <p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.5;">
                  Si necesitás ayuda, contactá a soporte o volvé a la aplicación.
                </p>
              </div>

              ${extra ? extra : ""}

              <!-- Cierre -->
              <p style="font-size:14px;color:#334155;margin:22px 0 6px;">
                Gracias por usar <strong style="color:#4B9991;">DogCatiFy</strong>.
              </p>
              <p style="font-size:14px;color:#0f172a;margin:0;">
                Equipo <strong style="color:#4B9991;">DogCatiFy Marketplace</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f2f4;text-align:center;padding:18px 14px;font-size:12px;color:#707070;">
              © ${new Date().getFullYear()} <span style="color:#4B9991;font-weight:700;">DogCatiFy</span>. Todos los derechos reservados.<br>
              Av. Siempreviva 742, Montevideo, Uruguay
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
};

const buildResultUrl = (
  status: "success" | "warning" | "danger" | "info",
  title: string,
  message: string,
  httpStatus: number,
) => {
  const baseUrl =
    Deno.env.get("PROMOTION_APPROVAL_RESULT_URL") ||
    Deno.env.get("APP_URL") ||
    "https://app.dogcatify.com/promotion-approval";

  try {
    const resultUrl = new URL(baseUrl);
    resultUrl.searchParams.set("status", status);
    resultUrl.searchParams.set("title", title);
    resultUrl.searchParams.set("message", message);
    resultUrl.searchParams.set("code", String(httpStatus));
    return resultUrl.toString();
  } catch {
    return "";
  }
};

const responseHtmlOrRedirect = (
  status: number,
  title: string,
  message: string,
  variant: HtmlVariant,
  extra?: string,
) => {
  const mappedStatus: "success" | "warning" | "danger" | "info" =
    variant === "success"
      ? "success"
      : variant === "danger"
      ? "danger"
      : variant === "warning"
      ? "warning"
      : "info";

  const redirectUrl = buildResultUrl(mappedStatus, title, message, status);
  if (redirectUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(html(title, message, variant, extra), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
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

    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "").toLowerCase();
    const token = url.searchParams.get("token") || "";

    if (!token || !["accept", "cancel", "reject"].includes(action)) {
      return responseHtmlOrRedirect(
        400,
        "Solicitud inválida",
        "El enlace no es válido o le falta información.",
        "warning",
      );
    }

    const tokenHash = await sha256(token);

    const { data: requestRow, error: requestError } = await supabase
      .from("promotion_approval_requests")
      .select("id, promotion_id, status, action_token_expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (requestError || !requestRow) {
      return responseHtmlOrRedirect(
        404,
        "Enlace no encontrado",
        "No encontramos una solicitud asociada a este enlace.",
        "danger",
      );
    }

    if (requestRow.status !== "pending") {
      return responseHtmlOrRedirect(
        200,
        "Solicitud ya procesada",
        "Esta solicitud ya fue procesada anteriormente.",
        "info",
      );
    }

    if (new Date(requestRow.action_token_expires_at).getTime() < Date.now()) {
      await supabase
        .from("promotion_approval_requests")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", requestRow.id);

      return responseHtmlOrRedirect(
        410,
        "Enlace expirado",
        "Este enlace ya expiró. Solicitá una nueva aprobación.",
        "warning",
      );
    }

    const decision = action === "accept" ? "approved" : "rejected";

    const { error: updateReqError } = await supabase
      .from("promotion_approval_requests")
      .update({
        status: decision,
        acted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id)
      .eq("status", "pending");

    if (updateReqError) {
      throw new Error(`REQUEST_UPDATE_FAILED: ${updateReqError.message}`);
    }

    const { error: updatePromotionError } = await supabase
      .from("promotions")
      .update({
        approval_status: decision,
        approval_decision_at: new Date().toISOString(),
        approval_decision_reason: action === "accept"
          ? "Aprobado por partner"
          : "Rechazado/cancelado por partner",
        is_active: action === "accept",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.promotion_id);

    if (updatePromotionError) {
      throw new Error(`PROMOTION_UPDATE_FAILED: ${updatePromotionError.message}`);
    }

    const okTitle = action === "accept" ? "Promoción aprobada" : "Promoción cancelada";
    const okMessage =
      action === "accept"
        ? "Gracias. La promoción fue aprobada y será activada en DogCatiFy."
        : "Recibimos tu respuesta. La promoción fue cancelada y no será activada.";

    // Extra opcional: botón a la app (si querés, agregá un APP_URL env)
    const appUrl = Deno.env.get("APP_URL") || "";
    const extra =
      appUrl
        ? `<a class="btn" href="${escapeHtml(appUrl)}" target="_blank" rel="noopener">Ir a DogCatiFy</a>
           <p class="muted" style="margin:10px 0 0;font-size:12px;line-height:1.4;">Abrí la app para ver el estado actualizado.</p>`
        : "";

    return responseHtmlOrRedirect(
      200,
      okTitle,
      okMessage,
      action === "accept" ? "success" : "warning",
      extra,
    );
  } catch (error: any) {
    console.error("Error in promotion-approval-action:", error);
    return responseHtmlOrRedirect(
      500,
      "Error",
      error?.message || "No se pudo procesar la solicitud",
      "danger",
    );
  }
});