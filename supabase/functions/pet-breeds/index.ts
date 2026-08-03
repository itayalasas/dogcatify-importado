import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Apikey, Content-Type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || "";
  const suppliedKey = req.headers.get("apikey")?.trim() || "";
  if (!anonKey || suppliedKey !== anonKey) return json({ error: "UNAUTHORIZED" }, 401);

  const apiBaseUrl = (Deno.env.get("PET_API_BASE_URL")?.trim() || "").replace(/\/+$/, "");
  const apiKey = Deno.env.get("PET_API_KEY")?.trim() || "";
  if (!apiBaseUrl || !apiKey) return json({ error: "MISSING_SERVER_CONFIG" }, 500);

  const url = new URL(req.url);
  const species = url.searchParams.get("species") === "cat" ? "cat" : "dog";
  const action = url.searchParams.get("action") === "search" ? "search" : "list";
  const name = url.searchParams.get("name")?.trim() || "";
  if (action === "search" && !name) return json({ error: "NAME_REQUIRED" }, 400);

  const path = action === "list"
    ? (species === "dog" ? "/alldogs" : "/allcats")
    : (species === "dog" ? "/dogs" : "/cats");
  const target = new URL(`${apiBaseUrl}${path}`);
  if (action === "search") target.searchParams.set("name", name);

  const upstream = await fetch(target, { headers: { "X-Api-Key": apiKey } });
  const payload = await upstream.text();
  if (!upstream.ok) return json({ error: "UPSTREAM_ERROR" }, 502);

  try {
    return json(JSON.parse(payload));
  } catch {
    return json({ error: "INVALID_UPSTREAM_RESPONSE" }, 502);
  }
});
