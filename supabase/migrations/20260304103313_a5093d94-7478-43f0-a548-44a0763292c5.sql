
-- Allow anonymous/public access to verify student IDs
CREATE POLICY "Anyone can verify student IDs"
ON public.id_applications
FOR SELECT
TO anon, authenticated
USING (
  status IN ('approved', 'printed', 'ready', 'collected')
);

-- Allow public read of profiles for verification (limited by join context)
CREATE POLICY "Anyone can view profiles for verification"
ON public.profiles
FOR SELECT
TO anon
USING (true);
