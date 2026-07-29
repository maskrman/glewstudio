-- Course progress tracking migration
-- Tracks which courses users have started/completed and how many hours they've watched

CREATE TABLE IF NOT EXISTS public.course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    course_title TEXT NOT NULL,
    course_instructor TEXT NOT NULL DEFAULT '',
    course_thumbnail TEXT NOT NULL DEFAULT '',
    course_thumbnail_alt TEXT NOT NULL DEFAULT '',
    watched_seconds INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one progress row per user per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_progress_user_course
    ON public.course_progress (user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_course_progress_user_id
    ON public.course_progress (user_id);

CREATE INDEX IF NOT EXISTS idx_course_progress_completed
    ON public.course_progress (user_id, completed);

-- Enable RLS
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_course_progress" ON public.course_progress;
CREATE POLICY "users_manage_own_course_progress"
ON public.course_progress
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
