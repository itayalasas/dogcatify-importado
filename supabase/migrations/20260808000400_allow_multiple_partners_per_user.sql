-- Bugfix: partners_user_id_unique (20260207021631_add_unique_constraint_partners_user_id.sql)
-- enforced "one partner row per user" as a deliberate design choice at the
-- time. That's since been superseded by subscription-gated multi-business
-- support (app/(tabs)/partner-register.tsx checks maxBusinessesAllowed from
-- the user's plan before allowing another registration) — the UI already
-- expects an owner to register more than one business, but this leftover
-- constraint makes the second INSERT fail with
-- "duplicate key value violates unique constraint partners_user_id_unique"
-- (23505) regardless of plan.
--
-- Verified before dropping: no foreign key references partners.user_id (all
-- partner_id FKs point at partners.id, the real primary key), and no
-- ON CONFLICT (user_id) upsert targets the partners table — the shared
-- Mercado Pago credential already lives in its own table,
-- partner_payment_credentials, correctly keyed by user_id there.

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_user_id_unique;
