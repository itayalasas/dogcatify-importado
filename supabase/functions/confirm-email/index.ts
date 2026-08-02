import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ConfirmationType = "signup" | "password_reset";

type ProfileRoleFlags = {
  isOwner: boolean;
  isPartner: boolean;
  isAdmin: boolean;
};

type ConfirmationRecord = {
  id: string;
  user_id: string;
  email: string;
  is_confirmed: boolean;
  confirmed_at: string | null;
  expires_at: string;
};

type AtomicConfirmationRecord = {
  confirmation_id: string;
  user_id: string;
  email: string;
  already_confirmed: boolean;
  confirmed_at: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const parseMetadataBoolean = (value: unknown): boolean | undefined => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const resolveProfileRoleFlagsFromMetadata = (
  metadata: Record<string, any> | null | undefined,
  existing?: Partial<ProfileRoleFlags> | null,
): ProfileRoleFlags => {
  const accountRole = String(metadata?.account_role || "").toLowerCase();
  const explicitOwner = parseMetadataBoolean(metadata?.is_owner);
  const explicitPartner = parseMetadataBoolean(metadata?.is_partner);
  const explicitAdmin = parseMetadataBoolean(metadata?.is_admin);
  const currentOwner = existing?.isOwner ?? true;
  const currentPartner = existing?.isPartner ?? false;
  const currentAdmin = existing?.isAdmin ?? false;

  if (accountRole === "partner") {
    return {
      isOwner: existing ? currentOwner : false,
      isPartner: true,
      isAdmin: explicitAdmin ?? currentAdmin,
    };
  }

  if (accountRole === "admin") {
    return {
      isOwner: explicitOwner ?? currentOwner,
      isPartner: explicitPartner ?? currentPartner,
      isAdmin: true,
    };
  }

  if (accountRole === "owner") {
    return {
      isOwner: true,
      isPartner: existing ? currentPartner : false,
      isAdmin: explicitAdmin ?? currentAdmin,
    };
  }

  return {
    isOwner: explicitOwner ?? currentOwner,
    isPartner: explicitPartner ?? currentPartner,
    isAdmin: explicitAdmin ?? currentAdmin,
  };
};

const normalizeType = (value: unknown): ConfirmationType => {
  return String(value || "signup").toLowerCase() === "password_reset"
    ? "password_reset"
    : "signup";
};

const readConfirmationInput = async (
  req: Request,
): Promise<{ token: string | null; type: ConfirmationType }> => {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token") || url.searchParams.get("token_hash");
  const queryType = normalizeType(url.searchParams.get("type"));

  if (req.method === "GET") {
    return {
      token: queryToken,
      type: queryType,
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    token: body?.token || body?.token_hash || queryToken,
    type: normalizeType(body?.type || queryType),
  };
};

const summarizeToken = (token: string): string => {
  const value = String(token || "");
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "METHOD_NOT_ALLOWED",
      },
      405,
    );
  }

  try {
    const requestId = crypto.randomUUID();
    const logPrefix = `[confirm-email:${requestId}]`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`${logPrefix} request received`, {
      method: req.method,
      url: req.url,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`${logPrefix} missing environment variables`, {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseServiceKey: !!supabaseServiceKey,
      });
      return jsonResponse(
        {
          success: false,
          error: "MISSING_ENVIRONMENT",
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { token, type } = await readConfirmationInput(req);

    console.log(`${logPrefix} parsed confirmation input`, {
      type,
      hasToken: !!token?.trim(),
      tokenPreview: token ? summarizeToken(token) : null,
    });

    if (!token?.trim()) {
      console.warn(`${logPrefix} missing token in request`);
      return jsonResponse(
        {
          success: false,
          error: "TOKEN_REQUIRED",
        },
        400,
      );
    }

    const confirmationType = normalizeType(type);
    const confirmationToken = token.trim();

    console.log(`${logPrefix} looking up email confirmation row`, {
      confirmationType,
      tokenPreview: summarizeToken(confirmationToken),
    });

    const { data: confirmation, error: tokenError } = await supabase
      .from("email_confirmations")
      .select("id, user_id, email, is_confirmed, confirmed_at, expires_at")
      .eq("token_hash", confirmationToken)
      .eq("type", confirmationType)
      .maybeSingle() as { data: ConfirmationRecord | null; error: any };

    if (tokenError || !confirmation) {
      console.warn(`${logPrefix} token lookup failed`, {
        error: tokenError?.message || null,
        code: tokenError?.code || null,
        tokenPreview: summarizeToken(confirmationToken),
        confirmationType,
      });
      return jsonResponse(
        {
          success: false,
          error: "TOKEN_NOT_FOUND",
        },
        404,
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(confirmation.expires_at);

    console.log(`${logPrefix} token row found`, {
      confirmationId: confirmation.id,
      userId: confirmation.user_id,
      email: confirmation.email,
      isConfirmed: confirmation.is_confirmed,
      expiresAt: confirmation.expires_at,
      nowIso,
    });

    if (!confirmation.is_confirmed && !Number.isNaN(expiresAt.getTime()) && now > expiresAt) {
      console.warn(`${logPrefix} token expired`, {
        confirmationId: confirmation.id,
        userId: confirmation.user_id,
        email: confirmation.email,
        expiresAt: confirmation.expires_at,
        nowIso,
      });
      return jsonResponse(
        {
          success: false,
          error: "TOKEN_EXPIRED",
          userId: confirmation.user_id,
          email: confirmation.email,
        },
        400,
      );
    }

    console.log(`${logPrefix} invoking atomic confirmation RPC`, {
      tokenPreview: summarizeToken(confirmationToken),
      confirmationType,
    });

    const { data: atomicConfirmation, error: atomicError } = await supabase.rpc(
      "confirm_email_signup_atomically",
      {
        p_token_hash: confirmationToken,
        p_type: confirmationType,
      },
    ) as { data: AtomicConfirmationRecord[] | null; error: any };

    if (atomicError || !atomicConfirmation?.length) {
      const errorMessage = String(
        atomicError?.message ||
          atomicError?.details ||
          atomicError?.hint ||
          "CONFIRMATION_TRANSACTION_FAILED",
      );
      const normalizedError = errorMessage.toUpperCase();

      console.error(`${logPrefix} atomic confirmation RPC failed`, {
        message: errorMessage,
        code: atomicError?.code || null,
        details: atomicError?.details || null,
        hint: atomicError?.hint || null,
        status: atomicError?.status || null,
        tokenPreview: summarizeToken(confirmationToken),
        confirmationType,
      });

      if (normalizedError.includes("TOKEN_NOT_FOUND")) {
        return jsonResponse(
          {
            success: false,
            error: "TOKEN_NOT_FOUND",
          },
          404,
        );
      }

      if (normalizedError.includes("TOKEN_EXPIRED")) {
        return jsonResponse(
          {
            success: false,
            error: "TOKEN_EXPIRED",
            userId: confirmation.user_id,
            email: confirmation.email,
          },
          400,
        );
      }

      if (normalizedError.includes("TOKEN_REQUIRED")) {
        return jsonResponse(
          {
            success: false,
            error: "TOKEN_REQUIRED",
          },
          400,
        );
      }

      if (normalizedError.includes("PROFILE_NOT_FOUND")) {
        return jsonResponse(
          {
            success: false,
            error: "PROFILE_NOT_FOUND",
            userId: confirmation.user_id,
            email: confirmation.email,
          },
          500,
        );
      }

      console.error("Error confirming token/profile atomically:", {
        error: errorMessage,
        details: atomicError,
      });

      return jsonResponse(
        {
          success: false,
          error: "CONFIRMATION_TRANSACTION_FAILED",
        },
        500,
      );
    }

    const confirmedRecord = atomicConfirmation[0];

    let authMetadata: Record<string, any> = {};
    try {
      console.log(`${logPrefix} reading auth metadata`, {
        userId: confirmedRecord.user_id,
      });
      const { data: authUserData } = await supabase.auth.admin.getUserById(confirmedRecord.user_id);
      authMetadata = authUserData?.user?.user_metadata || {};
    } catch (error) {
      console.warn(`${logPrefix} could not read auth metadata`, error);
    }

    try {
      console.log(`${logPrefix} updating auth.users`, {
        userId: confirmedRecord.user_id,
        email: confirmedRecord.email,
        alreadyConfirmed: confirmedRecord.already_confirmed,
      });
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        confirmedRecord.user_id,
        {
          email_confirm: true,
          user_metadata: {
            ...authMetadata,
            email_confirmed: true,
            email_confirmed_at: confirmedRecord.confirmed_at,
          },
        },
      );

      if (authUpdateError) {
        console.error(`${logPrefix} error updating auth.users`, authUpdateError);
        return jsonResponse(
          {
            success: false,
            error: "AUTH_UPDATE_ERROR",
            userId: confirmedRecord.user_id,
            email: confirmedRecord.email,
            alreadyConfirmed: confirmedRecord.already_confirmed,
            confirmedAt: confirmedRecord.confirmed_at,
          },
          500,
        );
      }
    } catch (error) {
      console.error(`${logPrefix} auth update threw`, error);
      return jsonResponse(
        {
          success: false,
          error: "AUTH_UPDATE_ERROR",
          userId: confirmedRecord.user_id,
          email: confirmedRecord.email,
          alreadyConfirmed: confirmedRecord.already_confirmed,
          confirmedAt: confirmedRecord.confirmed_at,
        },
        500,
      );
    }

    console.log("✅ Email confirmation completed successfully", {
      userId: confirmedRecord.user_id,
      email: confirmedRecord.email,
      alreadyConfirmed: confirmedRecord.already_confirmed,
      confirmedAt: confirmedRecord.confirmed_at,
    });

    console.log(`${logPrefix} email confirmation completed successfully`, {
      userId: confirmedRecord.user_id,
      email: confirmedRecord.email,
      alreadyConfirmed: confirmedRecord.already_confirmed,
      confirmedAt: confirmedRecord.confirmed_at,
      tokenPreview: summarizeToken(confirmationToken),
    });

    return jsonResponse({
      success: true,
      userId: confirmedRecord.user_id,
      email: confirmedRecord.email,
      alreadyConfirmed: confirmedRecord.already_confirmed,
      confirmedAt: confirmedRecord.confirmed_at,
    });
  } catch (error) {
    console.error("Error in confirm-email function:", error);
    return jsonResponse(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
});
