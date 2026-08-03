import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import QRCode from "npm:qrcode@1.5.4";

const configuredDomain = Deno.env.get("MOBILE_APP_DOMAIN")?.trim() || "https://app-dogcatify.netlify.app";
const allowedOrigin = new URL(configuredDomain).origin;

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Apikey, Content-Type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const body = await req.json().catch(() => ({}));
  const value = String(body?.url || "").trim();
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return json({ error: "INVALID_URL" }, 400);
  }

  const allowedHost = new URL(configuredDomain).host;
  if (target.protocol !== "https:" || target.host !== allowedHost || !target.pathname.startsWith("/medical-history/")) {
    return json({ error: "URL_NOT_ALLOWED" }, 400);
  }

  const qrCodeDataUrl = await QRCode.toDataURL(value, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#2D6A6F", light: "#FFFFFF" },
  });

  return json({ qrCodeDataUrl });
});
