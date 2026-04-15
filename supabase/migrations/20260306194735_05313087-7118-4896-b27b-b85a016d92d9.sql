
CREATE TABLE IF NOT EXISTS public.admin_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin text NOT NULL UNIQUE,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all admin pins" ON public.admin_pins
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));

CREATE POLICY "Super admins can update admin pins" ON public.admin_pins
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'::app_role));

CREATE POLICY "Users can view own pin" ON public.admin_pins
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND (role = _role OR (role = 'super_admin'::app_role AND _role = 'admin'::app_role))
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role app_role;
  _pin text;
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'staff' THEN
    IF NEW.email = 'bayahashim40@gmail.com' THEN
      _role := 'super_admin';
    ELSE
      _role := 'admin';
    END IF;
    _pin := NEW.raw_user_meta_data->>'admin_pin';
    IF _pin IS NULL OR length(_pin) != 6 THEN
      LOOP
        _pin := lpad(floor(random() * 1000000)::text, 6, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.admin_pins WHERE pin = _pin);
      END LOOP;
    END IF;
    INSERT INTO public.admin_pins (user_id, pin, is_approved)
    VALUES (NEW.id, _pin, CASE WHEN NEW.email = 'bayahashim40@gmail.com' THEN true ELSE false END);
  ELSE
    _role := 'student';
  END IF;
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;
