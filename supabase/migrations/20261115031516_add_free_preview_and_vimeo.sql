-- Add is_free_preview column to lessons and vimeo to video_provider enum

-- Add is_free_preview column to lessons table
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT false;

-- Add vimeo to lesson_video_provider enum
DO $$
BEGIN
  ALTER TYPE public.lesson_video_provider ADD VALUE IF NOT EXISTS 'vimeo';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_parameter_value THEN NULL; -- value already exists
END $$;