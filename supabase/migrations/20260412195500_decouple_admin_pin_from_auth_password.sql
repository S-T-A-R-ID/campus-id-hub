-- Decouple admin PIN lifecycle from auth password to allow one email
-- to use student password and admin PIN independently.

CREATE OR REPLACE FUNCTION public.admin_pin_login_rpc(
  p_pin text
)
RETURNS TABLE (
  email text,
  pin_changed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_is_approved boolean;
  v_pin_changed boolean;
  v_email text;
  v_email_confirmed_at timestamptz;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Invalid PIN format';
  END IF;

  SELECT ap.user_id, ap.is_approved, COALESCE(ap.pin_changed, false)
  INTO v_user_id, v_is_approved, v_pin_changed
  FROM public.admin_pins ap
  WHERE ap.pin = p_pin
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  IF NOT COALESCE(v_is_approved, false) THEN
    RAISE EXCEPTION 'Your account is pending approval by the super admin.';
  END IF;

  SELECT u.email, u.email_confirmed_at
  INTO v_email, v_email_confirmed_at
  FROM auth.users u
  WHERE u.id = v_user_id
  LIMIT 1;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Please verify your email first. Check your inbox for the confirmation link.';
  END IF;

  email := v_email;
  pin_changed := v_pin_changed;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pin_login_rpc(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_pin_rpc(
  p_email text,
  p_new_pin text,
  p_mark_changed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'New PIN must be exactly 4 digits';
  END IF;

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin account found with this email';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_pins WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'This email is not registered as an admin';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_pins
    WHERE pin = p_new_pin
      AND user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'This PIN is already in use. Please choose a different one.';
  END IF;

  UPDATE public.admin_pins
  SET pin = p_new_pin,
      pin_changed = CASE WHEN COALESCE(p_mark_changed, true) THEN true ELSE pin_changed END
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_pin_rpc(text, text, boolean) TO anon, authenticated;
