-- Allow authenticated users to insert their own subscription row on signup

DROP POLICY IF EXISTS "users_insert_own_subscription" ON public.subscriptions;
CREATE POLICY "users_insert_own_subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
