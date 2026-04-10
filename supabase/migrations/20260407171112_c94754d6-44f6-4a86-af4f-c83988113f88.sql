
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS otp_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_reg_number_unique ON public.profiles (reg_number) WHERE reg_number IS NOT NULL;
