-- Keep admin provisioning separate from auth passwords.
-- This allows a shared email to keep its student password while also being provisioned as admin.

CREATE OR REPLACE FUNCTION public.provision_admin_access(
  p_email text,
  p_full_name text,
  p_default_pin text,
  p_is_approved boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_has_profiles boolean;
  v_has_profiles_user_id boolean;
  v_has_profiles_full_name boolean;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF p_default_pin IS NULL OR p_default_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'Default PIN must be exactly 4 digits';
  END IF;

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email % (create/invite user in Auth first)', p_email;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_pins ap
    WHERE ap.pin = p_default_pin
      AND ap.user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'PIN % is already in use by another admin', p_default_pin;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO v_has_profiles;

  IF v_has_profiles THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) INTO v_has_profiles_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
    ) INTO v_has_profiles_full_name;

    IF v_has_profiles_user_id AND v_has_profiles_full_name THEN
      INSERT INTO public.profiles (user_id, full_name)
      VALUES (v_user_id, p_full_name)
      ON CONFLICT (user_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name;
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_pins (user_id, pin, is_approved, pin_changed)
  VALUES (v_user_id, p_default_pin, p_is_approved, false)
  ON CONFLICT (user_id)
  DO UPDATE SET
    pin = EXCLUDED.pin,
    is_approved = EXCLUDED.is_approved,
    pin_changed = false;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', lower(p_email),
    'default_pin', p_default_pin,
    'is_approved', p_is_approved,
    'message', 'Admin provisioned. User keeps their own auth password and changes PIN on first admin access.'
  );
END;
$$;
