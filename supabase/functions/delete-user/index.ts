import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "SUPABASE_ENV_REQUIRED" }, 500);
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ success: false, error: "AUTH_REQUIRED" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ success: false, error: "INVALID_AUTH_TOKEN" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId = String(body?.userId || "").trim();

    if (!requestedUserId) {
      return jsonResponse({ success: false, error: "USER_ID_REQUIRED" }, 400);
    }

    if (requestedUserId !== authData.user.id) {
      return jsonResponse({ success: false, error: "USER_ID_MISMATCH" }, 403);
    }

    // Best-effort cleanup for any rows left by older clients before removing auth.users.
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", requestedUserId);

    if (profileDeleteError) {
      return jsonResponse({
        success: false,
        error: `PROFILE_DELETE_FAILED: ${profileDeleteError.message}`,
      }, 409);
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(requestedUserId);
    if (deleteUserError) {
      return jsonResponse({
        success: false,
        error: `AUTH_DELETE_FAILED: ${deleteUserError.message}`,
      }, 500);
    }

    return jsonResponse({ success: true, userId: requestedUserId });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
