
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF _pin IS NULL OR length(_pin) != 4 THEN
      LOOP
        _pin := lpad(floor(random() * 10000)::text, 4, '0');
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
$function$;
