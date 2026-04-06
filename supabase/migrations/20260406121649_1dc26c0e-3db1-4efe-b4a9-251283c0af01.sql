ALTER TABLE public.id_applications ADD COLUMN IF NOT EXISTS verification_token text;

-- Generate verification tokens for existing approved applications
UPDATE public.id_applications
SET verification_token = encode(gen_random_bytes(32), 'hex')
WHERE status IN ('approved', 'printed', 'ready', 'collected')
AND verification_token IS NULL;

-- Create function to auto-generate verification token on approval
CREATE OR REPLACE FUNCTION public.generate_verification_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    NEW.verification_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_verification_token
  BEFORE UPDATE ON public.id_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_verification_token();