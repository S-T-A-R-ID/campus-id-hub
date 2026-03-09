CREATE POLICY "Students can update own lost reports to replacement_requested"
ON public.lost_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'not_found')
WITH CHECK (auth.uid() = user_id AND status = 'replacement_requested');