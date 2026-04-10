
-- Fix overly permissive notifications INSERT policy
DROP POLICY "System can create notifications" ON public.notifications;

-- Only admins and service role can create notifications
CREATE POLICY "Admins can create notifications" ON public.notifications 
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
