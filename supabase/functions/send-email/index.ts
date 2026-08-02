import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, X-Request-Id",
};

interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachment?: unknown;
  template_name?: string;
  recipient_email?: string;
  data?: unknown;
  [key: string]: unknown;
}

type EmailTargetInfo = {
  rawUrl: string;
  host: string | null;
  pathname: string | null;
  origin: string | null;
  isSupabaseFunctionTarget: boolean;
  pointsToConfirmEmail: boolean;
  pointsToSelfSendEmail: boolean;
};

const parseJsonSafely = (value: string): unknown | null => {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const safeObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>);
};

const describeEmailTarget = (rawUrl: string): EmailTargetInfo => {
  try {
    const parsed = new URL(rawUrl);
    return {
      rawUrl,
      host: parsed.host,
      pathname: parsed.pathname,
      origin: parsed.origin,
      isSupabaseFunctionTarget: parsed.pathname.includes("/functions/v1/"),
      pointsToConfirmEmail: parsed.pathname.includes("/confirm-email"),
      pointsToSelfSendEmail: parsed.pathname.includes("/send-email"),
    };
  } catch {
    return {
      rawUrl,
      host: null,
      pathname: null,
      origin: null,
      isSupabaseFunctionTarget: false,
      pointsToConfirmEmail: false,
      pointsToSelfSendEmail: false,
    };
  }
};

const buildBodySummary = (body: EmailRequest) => {
  const data = body.data;
  const dataKeys = safeObjectKeys(data);

  return {
    hasTemplate: !!body.template_name,
    template_name: body.template_name || null,
    recipient_email: body.recipient_email || null,
    hasLegacyTo: !!body.to,
    hasSubject: !!body.subject,
    order_id: body.order_id || null,
    wait_for_invoice: body.wait_for_invoice || null,
    hasData: !!data,
    dataKeys,
    extraKeys: Object.keys(body).filter((key) => {
      return ![
        "to",
        "subject",
        "text",
        "html",
        "attachment",
        "template_name",
        "recipient_email",
        "data",
      ].includes(key);
    }),
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const rawBody = await req.text();
    let body: EmailRequest = {} as EmailRequest;

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as EmailRequest;
      } catch (error) {
        console.error("[send-email] Failed to parse request JSON", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          bodyPreview: rawBody.slice(0, 1000),
        });
        return new Response(
          JSON.stringify({
            error: "Invalid JSON payload",
            request_id: requestId,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }
    }

    const incomingHeaders = {
      contentType: req.headers.get("content-type"),
      authorization: !!req.headers.get("authorization"),
      apiKey: !!req.headers.get("x-api-key"),
      requestId: req.headers.get("x-request-id"),
      userAgent: req.headers.get("user-agent"),
    };

    console.log("[send-email] request received", {
      requestId,
      method: req.method,
      url: req.url,
      headers: incomingHeaders,
      bodySummary: buildBodySummary(body),
    });

    const emailApiUrl = Deno.env.get("EMAIL_API_URL")?.trim() || "";
    const emailApiKey = Deno.env.get("EMAIL_API_KEY")?.trim() || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    const targetInfo = emailApiUrl ? describeEmailTarget(emailApiUrl) : null;

    console.log("[send-email] environment check", {
      requestId,
      emailApiUrl: emailApiUrl || null,
      emailApiHost: targetInfo?.host || null,
      emailApiPath: targetInfo?.pathname || null,
      hasEmailApiKey: !!emailApiKey,
      emailApiKeyLength: emailApiKey.length,
      hasSupabaseServiceKey: !!supabaseServiceKey,
    });

    if (!emailApiUrl) {
      console.error("[send-email] EMAIL_API_URL not configured in environment", {
        requestId,
      });
      console.error("[send-email] available env vars", Object.keys(Deno.env.toObject()));
      return new Response(
        JSON.stringify({
          error: "Email API not configured",
          details:
            "EMAIL_API_URL secret is not set. Please configure it in Supabase Dashboard > Edge Functions > Settings > Secrets",
          request_id: requestId,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    if (!emailApiKey) {
      console.error("[send-email] EMAIL_API_KEY not configured in environment", {
        requestId,
      });
      console.error("[send-email] available env vars", Object.keys(Deno.env.toObject()));
      return new Response(
        JSON.stringify({
          error: "Email API not configured",
          details:
            "EMAIL_API_KEY secret is not set. Please configure it in Supabase Dashboard > Edge Functions > Settings > Secrets",
          request_id: requestId,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    if (targetInfo?.pointsToConfirmEmail) {
      console.error("[send-email] Misconfigured EMAIL_API_URL: it points to confirm-email", {
        requestId,
        emailApiUrl,
        bodySummary: buildBodySummary(body),
      });

      return new Response(
        JSON.stringify({
          error: "Misconfigured EMAIL_API_URL",
          details: "EMAIL_API_URL is pointing to confirm-email instead of the email provider endpoint.",
          api_url: emailApiUrl,
          request_id: requestId,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    if (targetInfo?.pointsToSelfSendEmail) {
      console.warn("[send-email] EMAIL_API_URL points to a send-email endpoint", {
        requestId,
        emailApiUrl,
        targetHost: targetInfo.host,
        targetPath: targetInfo.pathname,
      });
    }

    if (body.template_name && body.recipient_email) {
      const payload: Record<string, unknown> = {
        template_name: body.template_name,
        recipient_email: body.recipient_email,
        data: body.data || {},
      };

      Object.keys(body).forEach((key) => {
        if (!["template_name", "recipient_email", "data"].includes(key)) {
          payload[key] = body[key];
        }
      });

      if (body.template_name === "promotion_send") {
        payload.wait_for_invoice = true;
        payload.force_wait_for_invoice = true;
      }

      const isSupabaseFunctionTarget = emailApiUrl.includes("/functions/v1/");
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": emailApiKey,
        "X-Integration-Key": emailApiKey,
        Authorization: `Bearer ${emailApiKey}`,
        "X-Request-Id": requestId,
      };

      if (isSupabaseFunctionTarget && supabaseServiceKey) {
        requestHeaders.apikey = supabaseServiceKey;
      }

      console.log("[send-email] outbound request", {
        requestId,
        target: targetInfo,
        isSupabaseFunctionTarget,
        hasXApiKeyHeader: !!requestHeaders["x-api-key"],
        hasApikeyHeader: !!requestHeaders.apikey,
        payloadSummary: {
          template_name: payload.template_name,
          recipient_email: payload.recipient_email,
          payloadKeys: Object.keys(payload),
          dataKeys: safeObjectKeys(payload.data),
          payloadSize: JSON.stringify(payload).length,
        },
      });

      const response = await fetch(emailApiUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      const responseBody = parseJsonSafely(responseText);

      console.log("[send-email] external API response", {
        requestId,
        status: response.status,
        ok: response.ok,
        durationMs: Date.now() - startedAt,
        responseContentType: response.headers.get("content-type"),
        bodyPreview: responseText.slice(0, 1200),
      });

      if (!response.ok) {
        console.error("[send-email] email API error response", {
          requestId,
          status: response.status,
          emailApiUrl,
          target: targetInfo,
          bodyPreview: responseText.slice(0, 1200),
        });

        return new Response(
          JSON.stringify({
            error: `Email API error: ${response.status}`,
            details: responseText,
            api_url: emailApiUrl,
            request_id: requestId,
          }),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      const result = responseBody ?? { raw: responseText };
      console.log("[send-email] email forwarded successfully", {
        requestId,
        durationMs: Date.now() - startedAt,
        resultKeys: result && typeof result === "object" ? Object.keys(result as Record<string, unknown>) : [],
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    console.log("[send-email] legacy email request rejected", {
      requestId,
      bodySummary: buildBodySummary(body),
    });
    console.warn("[send-email] legacy HTML email format is not supported anymore");

    return new Response(
      JSON.stringify({
        error: "Legacy email format not supported",
        message: "Please use template-based emails with template_name parameter",
        details: "Direct HTML emails should be migrated to use the template system",
        request_id: requestId,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[send-email] Error processing email request", {
      requestId,
      error: errorMessage,
    });
    console.error("[send-email] Error stack", errorStack);

    return new Response(
      JSON.stringify({
        error: "Failed to process email request",
        details: errorMessage,
        timestamp: new Date().toISOString(),
        request_id: requestId,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
});
