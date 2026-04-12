-- Keep auth password synchronized with admin PIN at sign-in time.
-- This removes dependency on separate manual sync scripts.
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

  -- Ensure auth password always matches latest valid PIN.
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  WHERE id = v_user_id;

  email := v_email;
  pin_changed := v_pin_changed;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pin_login_rpc(text) TO anon, authenticated;
