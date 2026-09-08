-- Course Purchases table for Glewstudio
-- Migration: 20260804020000_create_course_purchases

-- 1. Create course_purchases table
CREATE TABLE IF NOT EXISTS public.course_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  price_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Unique constraint: one purchase per user per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_purchases_user_course
  ON public.course_purchases (user_id, course_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON public.course_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_course_id ON public.course_purchases(course_id);

-- 4. Enable RLS
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_course_purchases" ON public.course_purchases;
CREATE POLICY "users_manage_own_course_purchases"
ON public.course_purchases
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
