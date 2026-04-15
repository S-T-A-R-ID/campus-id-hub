-- Definitive fix for legacy student_id schema drift.
-- Canonical actor column is user_id; remove student_id constraints and column.

BEGIN;

-- Normalize profiles schema expected by frontend code.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Legacy environments may have profiles.id as NOT NULL without a default.
ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  -- Backfill from profiles.id when it is actually an auth.users id.
  UPDATE public.profiles p
  SET user_id = p.id
  WHERE p.user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = p.id
    );

  -- Backfill from legacy profiles.student_id if present.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'student_id'
  ) THEN
    UPDATE public.profiles p
    SET user_id = p.student_id
    WHERE p.user_id IS NULL
      AND p.student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = p.student_id
      );
  END IF;

  -- Ensure each auth user has one profile row keyed by user_id.
  INSERT INTO public.profiles (id, user_id, full_name)
  SELECT gen_random_uuid(), u.id, COALESCE(u.raw_user_meta_data->>'full_name', '')
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = u.id
  );
END
$$;

DO $$
DECLARE
  r record;
BEGIN
  -- Remove legacy profile policies that reference wrong actor columns.
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND (
        COALESCE(qual, '') ILIKE '%student_id%'
        OR COALESCE(with_check, '') ILIKE '%student_id%'
        OR COALESCE(qual, '') ILIKE '%auth.uid() = id%'
        OR COALESCE(with_check, '') ILIKE '%auth.uid() = id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.profiles
  ALTER COLUMN user_id SET DEFAULT auth.uid();

DO $$
BEGIN
  -- We intentionally set NOT NULL only when all rows are backfilled.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id IS NULL) THEN
    ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END
$$;

ALTER TABLE public.id_applications
  ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
DECLARE
  profiles_has_user_id boolean;
  profiles_has_id boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'id_applications'
      AND column_name = 'student_id'
  ) THEN
    -- Case 1: student_id already stores auth.users.id values.
    UPDATE public.id_applications ia
    SET user_id = ia.student_id
    WHERE ia.user_id IS NULL
      AND ia.student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = ia.student_id
      );

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'user_id'
    ) INTO profiles_has_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'id'
    ) INTO profiles_has_id;

    IF profiles_has_user_id THEN
      -- Case 2a: student_id stores profiles.id and profiles.user_id points to auth.users.id.
      UPDATE public.id_applications ia
      SET user_id = p.user_id
      FROM public.profiles p
      WHERE ia.user_id IS NULL
        AND ia.student_id IS NOT NULL
        AND p.id = ia.student_id;
    ELSIF profiles_has_id THEN
      -- Case 2b: profiles.id might directly be auth.users.id in some legacy schemas.
      UPDATE public.id_applications ia
      SET user_id = p.id
      FROM public.profiles p
      WHERE ia.user_id IS NULL
        AND ia.student_id IS NOT NULL
        AND p.id = ia.student_id
        AND EXISTS (
          SELECT 1
          FROM auth.users u
          WHERE u.id = p.id
        );
    END IF;
  END IF;
END
$$;

DO $$
DECLARE
  legacy_fk record;
BEGIN
  FOR legacy_fk IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'id_applications'
      AND c.contype = 'f'
      AND c.conname ILIKE '%student%id%fkey%'
  LOOP
    EXECUTE format('ALTER TABLE public.id_applications DROP CONSTRAINT IF EXISTS %I', legacy_fk.conname);
  END LOOP;
END
$$;

DO $$
DECLARE
  r record;
BEGIN
  -- Drop only policies that still depend on legacy student_id.
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_applications'
      AND (
        COALESCE(qual, '') ILIKE '%student_id%'
        OR COALESCE(with_check, '') ILIKE '%student_id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.id_applications', r.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.id_applications
  DROP COLUMN IF EXISTS student_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.id_applications
    WHERE user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'id_applications contains NULL user_id rows. Resolve those rows first, then rerun this migration.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_applications'
      AND policyname = 'Users can view own applications'
  ) THEN
    CREATE POLICY "Users can view own applications"
    ON public.id_applications
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_applications'
      AND policyname = 'Users can create own applications'
  ) THEN
    CREATE POLICY "Users can create own applications"
    ON public.id_applications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'id_applications'
      AND policyname = 'Users can update own draft applications'
  ) THEN
    CREATE POLICY "Users can update own draft applications"
    ON public.id_applications
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'draft');
  END IF;
END
$$;

ALTER TABLE public.id_applications
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.id_applications'::regclass
      AND conname = 'id_applications_user_id_fkey'
  ) THEN
    ALTER TABLE public.id_applications
      ADD CONSTRAINT id_applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS sync_id_application_actor_columns_trg ON public.id_applications;
DROP FUNCTION IF EXISTS public.sync_id_application_actor_columns();

CREATE OR REPLACE FUNCTION public.id_applications_set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS id_applications_set_user_id_trg ON public.id_applications;
CREATE TRIGGER id_applications_set_user_id_trg
BEFORE INSERT ON public.id_applications
FOR EACH ROW
EXECUTE FUNCTION public.id_applications_set_user_id();

COMMIT;
