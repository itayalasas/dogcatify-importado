-- Security hardening: close overly-permissive RLS on user_carts, audit_logs,
-- crm_webhook_debug_logs, and promotion_approval_requests. Verified against
-- client usage before writing this (confirmed independently via
-- `supabase db advisors --linked`, which also flagged admin_settings,
-- crm_webhook_debug_logs, and promotion_approval_requests as
-- "RLS Disabled in Public"):
--   - user_carts: only ever queried with .eq('user_id', currentUser.id) (CartContext.tsx,
--     delete-account.tsx). No cross-user read exists in the client.
--   - audit_logs: client only INSERTs (services/auditService.ts); no client SELECT exists.
--     The existing "TEMP DEBUG" policy let any authenticated user read everyone's audit trail.
--   - crm_webhook_debug_logs: zero client references anywhere; only written by DB triggers
--     with definer privileges / read by service_role from edge functions.
--   - promotion_approval_requests: zero client references anywhere; only used by
--     the promotion-approval-action and send-promotion-approval-request edge
--     functions (service_role).

-- user_carts: restrict SELECT to the owner (INSERT/UPDATE/DELETE were already owner-scoped)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_carts;
DROP POLICY IF EXISTS "Users can read their own cart" ON public.user_carts;

CREATE POLICY "Users can read their own cart"
ON public.user_carts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- audit_logs: remove the public read policy left over from debugging
DROP POLICY IF EXISTS "Authenticated users can view audit logs (TEMP DEBUG)" ON public.audit_logs;

-- crm_webhook_debug_logs: enable RLS with no anon/authenticated policies at all.
-- Also revoke the blanket GRANT ALL (which included TRUNCATE/DDL-ish privileges that
-- RLS row policies alone don't gate) — only service_role needs access here.
ALTER TABLE public.crm_webhook_debug_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_webhook_debug_logs FROM anon, authenticated;

-- promotion_approval_requests: same treatment, found via the security advisor
-- while validating this migration (not in the original audit) — no policies,
-- no RLS, zero client usage.
ALTER TABLE public.promotion_approval_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.promotion_approval_requests FROM anon, authenticated;
