-- Watchlist module migration
-- Users can save courses to their personal watchlist

CREATE TABLE IF NOT EXISTS public.watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    course_title TEXT NOT NULL,
    course_instructor TEXT NOT NULL,
    course_thumbnail TEXT NOT NULL,
    course_thumbnail_alt TEXT NOT NULL DEFAULT '',
    course_duration TEXT NOT NULL,
    course_tier TEXT NOT NULL DEFAULT 'apertura',
    course_rating NUMERIC(3,1),
    course_lesson_count INTEGER,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one entry per user per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_user_course ON public.watchlist (user_id, course_id);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON public.watchlist (added_at DESC);

-- Enable RLS
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "users_manage_own_watchlist" ON public.watchlist;
CREATE POLICY "users_manage_own_watchlist"
ON public.watchlist
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
