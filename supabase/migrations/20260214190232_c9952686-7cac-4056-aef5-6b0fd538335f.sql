
-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('draft', 'submitted', 'verified', 'approved', 'printed', 'ready', 'collected', 'rejected');

-- Create enum for lost report status
CREATE TYPE public.lost_report_status AS ENUM ('reported', 'searching', 'found', 'not_found', 'replacement_requested', 'replacement_issued');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  reg_number TEXT UNIQUE,
  faculty TEXT,
  department TEXT,
  course TEXT,
  campus TEXT DEFAULT 'Main Campus',
  year_of_study INTEGER,
  phone TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE (user_id, role)
);

-- ID applications table
CREATE TABLE public.id_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status application_status NOT NULL DEFAULT 'draft',
  photo_url TEXT,
  admin_comment TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  is_replacement BOOLEAN DEFAULT FALSE,
  card_number TEXT UNIQUE,
  qr_data TEXT,
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  printed_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lost reports table
CREATE TABLE public.lost_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.id_applications(id) ON DELETE CASCADE NOT NULL,
  status lost_report_status NOT NULL DEFAULT 'reported',
  date_lost DATE NOT NULL,
  circumstances TEXT,
  location_lost TEXT,
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_id_applications_updated_at BEFORE UPDATE ON public.id_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lost_reports_updated_at BEFORE UPDATE ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and assign student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for id_applications
CREATE POLICY "Users can view own applications" ON public.id_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own applications" ON public.id_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own draft applications" ON public.id_applications FOR UPDATE USING (auth.uid() = user_id AND status = 'draft');
CREATE POLICY "Admins can view all applications" ON public.id_applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all applications" ON public.id_applications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for lost_reports
CREATE POLICY "Users can view own lost reports" ON public.lost_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own lost reports" ON public.lost_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all lost reports" ON public.lost_reports FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all lost reports" ON public.lost_reports FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (TRUE);

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for student photos
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true);

-- Storage policies
CREATE POLICY "Users can upload own photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Photos are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.id_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
