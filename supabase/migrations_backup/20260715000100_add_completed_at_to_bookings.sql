-- Add a completion timestamp to bookings so reservation closures can be tracked
-- without breaking the partner/customer booking flows.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

COMMENT ON COLUMN public.bookings.completed_at IS
  'Timestamp when the booking was marked as completed.';

-- Best-effort backfill for already completed bookings.
UPDATE public.bookings
SET completed_at = COALESCE(updated_at, created_at, now())
WHERE status = 'completed'
  AND completed_at IS NULL;
