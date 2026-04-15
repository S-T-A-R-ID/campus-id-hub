-- Add missing created_at columns for older databases.

BEGIN;

ALTER TABLE public.id_applications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.id_applications
SET created_at = COALESCE(created_at, submitted_at, approved_at, updated_at, now());

ALTER TABLE public.lost_reports
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.lost_reports
SET created_at = COALESCE(created_at, updated_at, now());

COMMIT;
