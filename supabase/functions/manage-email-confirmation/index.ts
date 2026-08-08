import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ProfileRoleFlags = {
  isOwner: boolean;
  isPartner: boolean;
  isAdmin: boolean;
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

const generateToken = (): string =>
  `${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;

const APP_DOMAIN_FALLBACK = "https://app.dogcatify.com";

const buildConfirmationUrl = (token: string, type: "signup" | "password_reset"): string => {
  const baseUrl = String(Deno.env.get("EXPO_PUBLIC_APP_DOMAIN") || APP_DOMAIN_FALLBACK).replace(/\/+$/, "");
  return type === "password_reset"
    ? `${baseUrl}/auth/reset-password?token=${token}`
    : `${baseUrl}/auth/confirm?token_hash=${token}&type=signup`;
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    // --- action: create-token (signup only) -----------------------------
    // Called right after supabaseClient.auth.signUp() from register.tsx /
    // become-partner.tsx. become-partner.tsx signs the user out immediately
    // after signUp(), so we can't require a bearer session here — instead we
    // validate that the supplied (userId, email) pair is internally
    // consistent with a real auth.users row before creating the token.
    // Low-severity by design: worst case is marking someone else's signup
    // email_confirmed early, which grants no login access on its own.
    if (action === "create-token") {
      const userId = String(body?.userId || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();

      if (!userId || !email) {
        return jsonResponse({ success: false, error: "USER_ID_AND_EMAIL_REQUIRED" }, 400);
      }

      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUserData?.user || authUserData.user.email?.toLowerCase() !== email) {
        return jsonResponse({ success: false, error: "USER_EMAIL_MISMATCH" }, 403);
      }

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from("email_confirmations").insert({
        user_id: userId,
        email,
        token_hash: token,
        type: "signup",
        is_confirmed: false,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[manage-email-confirmation] create-token insert failed", insertError);
        return jsonResponse({ success: false, error: "TOKEN_CREATE_FAILED" }, 500);
      }

      return jsonResponse({
        success: true,
        token,
        confirmationUrl: buildConfirmationUrl(token, "signup"),
      });
    }

    // --- action: password-reset ------------------------------------------
    // Called from app/auth/forgot-password.tsx, unauthenticated by design.
    // Creates the token AND sends the email itself — the raw token never
    // reaches the client, closing the account-takeover vector that existed
    // when the client held a service_role key and could mint+read tokens.
    if (action === "password-reset") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!email) {
        return jsonResponse({ success: false, error: "EMAIL_REQUIRED" }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("email", email)
        .maybeSingle();

      if (profileError || !profile) {
        // Keep parity with existing UX (forgot-password.tsx already shows a
        // friendly "user not found" message from its own pre-check), but
        // don't leak existence here beyond what that screen already does.
        return jsonResponse({ success: false, error: "USER_NOT_FOUND" }, 404);
      }

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from("email_confirmations").insert({
        user_id: profile.id,
        email,
        token_hash: token,
        type: "password_reset",
        is_confirmed: false,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[manage-email-confirmation] password-reset insert failed", insertError);
        return jsonResponse({ success: false, error: "TOKEN_CREATE_FAILED" }, 500);
      }

      const resetUrl = buildConfirmationUrl(token, "password_reset");

      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          template_name: "reset-password",
          recipient_email: email,
          data: {
            client_name: profile.display_name || "Usuario",
            reset_url: resetUrl,
          },
        },
      });

      if (sendError) {
        console.error("[manage-email-confirmation] password-reset send-email failed", sendError);
        return jsonResponse({ success: false, error: "EMAIL_SEND_FAILED" }, 502);
      }

      return jsonResponse({ success: true });
    }

    // --- action: resend (signup confirmation) ----------------------------
    // Called from app/auth/login.tsx and app/auth/confirm.tsx when the user
    // isn't fully authenticated yet. Mirrors the old resendConfirmationEmail
    // behavior (find-or-create profile, sync role flags, invalidate old
    // tokens, issue a new one) but keeps the token server-side.
    if (action === "resend") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!email) {
        return jsonResponse({ success: false, error: "EMAIL_REQUIRED" }, 400);
      }

      let userId: string | null = null;
      let displayName = "Usuario";
      let existingRoleFlags: Partial<ProfileRoleFlags> | null = null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name, is_owner, is_partner, is_admin")
        .eq("email", email)
        .maybeSingle();

      if (profileData) {
        userId = profileData.id;
        displayName = profileData.display_name || "Usuario";
        existingRoleFlags = {
          isOwner: profileData.is_owner ?? true,
          isPartner: profileData.is_partner ?? false,
          isAdmin: profileData.is_admin ?? false,
        };
      } else {
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
          console.error("[manage-email-confirmation] resend listUsers failed", listError);
          return jsonResponse({ success: false, error: "USER_LOOKUP_FAILED" }, 500);
        }
        const foundUser = listData.users.find((u) => u.email?.toLowerCase() === email) || null;

        if (!foundUser) {
          return jsonResponse({ success: false, error: "USER_NOT_FOUND" }, 404);
        }

        userId = foundUser.id;
        displayName = (foundUser.user_metadata?.full_name as string) || "Usuario";
        const roleFlags = resolveProfileRoleFlagsFromMetadata(foundUser.user_metadata, null);

        const { error: createProfileError } = await supabase.from("profiles").insert({
          id: userId,
          email,
          display_name: displayName,
          is_owner: roleFlags.isOwner,
          is_partner: roleFlags.isPartner,
          is_admin: roleFlags.isAdmin,
          email_confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (createProfileError) {
          console.warn("[manage-email-confirmation] resend profile backfill failed", createProfileError);
        }

        existingRoleFlags = { isOwner: roleFlags.isOwner, isPartner: roleFlags.isPartner, isAdmin: roleFlags.isAdmin };
      }

      if (!userId) {
        return jsonResponse({ success: false, error: "USER_NOT_FOUND" }, 404);
      }
      const confirmedUserId: string = userId;

      try {
        const { data: authUserData } = await supabase.auth.admin.getUserById(confirmedUserId);
        const roleFlags = resolveProfileRoleFlagsFromMetadata(authUserData?.user?.user_metadata, existingRoleFlags);
        await supabase
          .from("profiles")
          .update({
            is_owner: roleFlags.isOwner,
            is_partner: roleFlags.isPartner,
            is_admin: roleFlags.isAdmin,
            updated_at: new Date().toISOString(),
          })
          .eq("id", confirmedUserId);
      } catch (syncError) {
        console.warn("[manage-email-confirmation] resend role sync failed", syncError);
      }

      await supabase
        .from("email_confirmations")
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("user_id", confirmedUserId)
        .eq("type", "signup")
        .eq("is_confirmed", false);

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from("email_confirmations").insert({
        user_id: confirmedUserId,
        email,
        token_hash: token,
        type: "signup",
        is_confirmed: false,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[manage-email-confirmation] resend insert failed", insertError);
        return jsonResponse({ success: false, error: "TOKEN_CREATE_FAILED" }, 500);
      }

      const confirmationUrl = buildConfirmationUrl(token, "signup");

      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          template_name: "confirmation",
          recipient_email: email,
          data: { client_name: displayName, confirmation_url: confirmationUrl, token, token_hash: token },
          token,
          token_hash: token,
        },
      });

      if (sendError) {
        console.error("[manage-email-confirmation] resend send-email failed", sendError);
        return jsonResponse({ success: false, error: "EMAIL_SEND_FAILED" }, 502);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("[manage-email-confirmation] unhandled error", error);
    return jsonResponse({ success: false, error: "INTERNAL_SERVER_ERROR" }, 500);
  }
});
