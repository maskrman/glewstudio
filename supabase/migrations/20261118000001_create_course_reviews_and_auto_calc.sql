-- Create course_reviews table and auto-calculation functions for duration and rating

-- 1. Create course_reviews table
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, user_id)
);

-- 2. Enable RLS on course_reviews
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for course_reviews
-- Public read access (anyone can view reviews)
DROP POLICY IF EXISTS "public_read_course_reviews" ON public.course_reviews;
CREATE POLICY "public_read_course_reviews"
  ON public.course_reviews
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can insert their own reviews
DROP POLICY IF EXISTS "authenticated_insert_course_reviews" ON public.course_reviews;
CREATE POLICY "authenticated_insert_course_reviews"
  ON public.course_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own reviews
DROP POLICY IF EXISTS "authenticated_update_course_reviews" ON public.course_reviews;
CREATE POLICY "authenticated_update_course_reviews"
  ON public.course_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own reviews
DROP POLICY IF EXISTS "authenticated_delete_course_reviews" ON public.course_reviews;
CREATE POLICY "authenticated_delete_course_reviews"
  ON public.course_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin full access
DROP POLICY IF EXISTS "admin_all_course_reviews" ON public.course_reviews;
CREATE POLICY "admin_all_course_reviews"
  ON public.course_reviews
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Trigger for updated_at on course_reviews
DROP TRIGGER IF EXISTS set_course_reviews_updated_at ON public.course_reviews;
CREATE TRIGGER set_course_reviews_updated_at
  BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Function to recalculate course duration from lessons
CREATE OR REPLACE FUNCTION public.recalculate_course_duration(p_course_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_seconds INTEGER := 0;
  v_duration_text TEXT;
BEGIN
  -- Sum all lesson durations for this course
  SELECT COALESCE(SUM(l.duration_seconds), 0)
  INTO v_total_seconds
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id;

  -- Format duration as text
  IF v_total_seconds >= 3600 THEN
    v_duration_text := (v_total_seconds / 3600) || 'h ' || ((v_total_seconds % 3600) / 60) || 'min';
  ELSE
    v_duration_text := (v_total_seconds / 60) || 'min';
  END IF;

  -- Update course duration
  UPDATE public.courses
  SET duration = v_duration_text,
      lesson_count = (
        SELECT COUNT(*)
        FROM public.lessons l
        JOIN public.course_modules m ON l.module_id = m.id
        WHERE m.course_id = p_course_id
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_course_id;
END;
$$;

-- 6. Function to recalculate course average rating from reviews
CREATE OR REPLACE FUNCTION public.recalculate_course_rating(p_course_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg_rating NUMERIC(3,1);
BEGIN
  -- Calculate average rating
  SELECT ROUND(AVG(rating)::numeric, 1)
  INTO v_avg_rating
  FROM public.course_reviews
  WHERE course_id = p_course_id;

  -- Update course rating (0 if no reviews)
  UPDATE public.courses
  SET rating = COALESCE(v_avg_rating, 0),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_course_id;
END;
$$;

-- 7. Trigger function for lessons (must be defined BEFORE the trigger)
CREATE OR REPLACE FUNCTION public.recalculate_course_duration_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  -- Get course_id from the module
  IF TG_OP = 'DELETE' THEN
    SELECT m.course_id INTO v_course_id
    FROM public.course_modules m
    WHERE m.id = OLD.module_id;
  ELSE
    SELECT m.course_id INTO v_course_id
    FROM public.course_modules m
    WHERE m.id = NEW.module_id;
  END IF;

  IF v_course_id IS NOT NULL THEN
    PERFORM public.recalculate_course_duration(v_course_id);
  END IF;

  RETURN NULL; -- Result is ignored since this is an AFTER trigger
END;
$$;

-- 8. Trigger to recalculate duration when lessons change
DROP TRIGGER IF EXISTS trigger_recalculate_course_duration ON public.lessons;
CREATE TRIGGER trigger_recalculate_course_duration
  AFTER INSERT OR UPDATE OR DELETE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_course_duration_trigger();

-- 9. Trigger function for reviews (must be defined BEFORE the trigger)
CREATE OR REPLACE FUNCTION public.recalculate_course_rating_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_course_id := OLD.course_id;
  ELSE
    v_course_id := NEW.course_id;
  END IF;

  IF v_course_id IS NOT NULL THEN
    PERFORM public.recalculate_course_rating(v_course_id);
  END IF;

  RETURN NULL; -- Result is ignored since this is an AFTER trigger
END;
$$;

-- 10. Trigger to recalculate rating when reviews change
DROP TRIGGER IF EXISTS trigger_recalculate_course_rating ON public.course_reviews;
CREATE TRIGGER trigger_recalculate_course_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_course_rating_trigger();

-- 11. Trigger function for modules (must be defined BEFORE the trigger)
CREATE OR REPLACE FUNCTION public.recalculate_course_duration_module_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_course_id := OLD.course_id;
  ELSE
    v_course_id := NEW.course_id;
  END IF;

  IF v_course_id IS NOT NULL THEN
    PERFORM public.recalculate_course_duration(v_course_id);
  END IF;

  RETURN NULL;
END;
$$;

-- 12. Trigger to recalculate duration when modules are added/removed
DROP TRIGGER IF EXISTS trigger_recalculate_course_duration_module ON public.course_modules;
CREATE TRIGGER trigger_recalculate_course_duration_module
  AFTER INSERT OR DELETE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_course_duration_module_trigger();

-- 13. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_id ON public.course_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_created_at ON public.course_reviews(created_at DESC);

-- 14. Comments
COMMENT ON TABLE public.course_reviews IS 'Student reviews and ratings for courses (1-5 stars)';
COMMENT ON COLUMN public.course_reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.course_reviews.comment IS 'Optional written review';
COMMENT ON FUNCTION public.recalculate_course_duration IS 'Recalculates course duration and lesson count from all lessons';
COMMENT ON FUNCTION public.recalculate_course_rating IS 'Recalculates course average rating from all reviews';

-- 15. Recalculate for existing courses
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.courses LOOP
    PERFORM public.recalculate_course_duration(rec.id);
    PERFORM public.recalculate_course_rating(rec.id);
  END LOOP;
END $$;