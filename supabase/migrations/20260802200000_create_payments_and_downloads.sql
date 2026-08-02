-- payments table: stores real payment history per user
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  payment_method TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_payments" ON public.payments;
CREATE POLICY "users_view_own_payments"
ON public.payments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_payments" ON public.payments;
CREATE POLICY "service_insert_payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- downloads table: tracks files the user has actually downloaded
CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'PDF',
  file_size TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON public.downloads(downloaded_at DESC);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_downloads" ON public.downloads;
CREATE POLICY "users_manage_own_downloads"
ON public.downloads
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
