-- SQL helpers for super-admin controlled provisioning of admin accounts.
-- Usage is intended from Supabase SQL editor.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'super_admin');
  END IF;
END;
$$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.admin_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin text NOT NULL UNIQUE,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_pins
  ADD COLUMN IF NOT EXISTS pin_changed boolean DEFAULT false;

ALTER TABLE public.admin_pins ENABLE ROW LEVEL SECURITY;

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

  -- Keep auth password synchronized with default admin PIN for direct PIN sign-in.
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_default_pin, extensions.gen_salt('bf'))
  WHERE id = v_user_id;

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
    'message', 'Admin provisioned. User must verify email and then change PIN on first access.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_access(
  p_email text,
  p_delete_auth_user boolean DEFAULT false
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

  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email %', p_email;
  END IF;

  DELETE FROM public.admin_pins
  WHERE user_id = v_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND lower(role::text) = 'admin';

  IF p_delete_auth_user THEN
    DELETE FROM auth.users
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', lower(p_email),
    'auth_user_deleted', p_delete_auth_user
  );
END;
$$;

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

  -- Keep auth password synchronized with latest PIN.
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_pin_rpc(text, text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_admin_state_rpc()
RETURNS TABLE (
  is_admin boolean,
  is_super_admin boolean,
  is_admin_approved boolean,
  pin_changed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_roles text[];
  v_has_admin_pin boolean;
  v_is_approved boolean;
  v_pin_changed boolean;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    is_admin := false;
    is_super_admin := false;
    is_admin_approved := false;
    pin_changed := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(ur.role::text), ARRAY[]::text[])
  INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_pins ap WHERE ap.user_id = v_user_id
  ) INTO v_has_admin_pin;

  SELECT COALESCE(ap.is_approved, false), COALESCE(ap.pin_changed, false)
  INTO v_is_approved, v_pin_changed
  FROM public.admin_pins ap
  WHERE ap.user_id = v_user_id
  LIMIT 1;

  is_super_admin := 'super_admin' = ANY(v_roles);
  is_admin := is_super_admin OR 'admin' = ANY(v_roles) OR v_has_admin_pin;
  is_admin_approved := CASE WHEN is_admin THEN COALESCE(v_is_approved, true) ELSE false END;
  pin_changed := CASE WHEN is_admin THEN COALESCE(v_pin_changed, false) ELSE true END;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_admin_state_rpc() TO authenticated;
