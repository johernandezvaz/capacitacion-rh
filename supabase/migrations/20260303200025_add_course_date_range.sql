/*
  # Add Date Range to Courses

  1. Changes
    - Add `start_date` (date, nullable) to courses table
    - Add `end_date` (date, nullable) to courses table
    - Add check constraint to ensure end_date >= start_date when both are provided
  
  2. Notes
    - Both fields are optional to support existing courses
    - No breaking changes to existing data
    - Constraint only applies when both dates are provided
*/

-- Add start_date and end_date columns to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE courses ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE courses ADD COLUMN end_date date;
  END IF;
END $$;

-- Add constraint to ensure end_date is not before start_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'courses_date_range_check'
  ) THEN
    ALTER TABLE courses 
    ADD CONSTRAINT courses_date_range_check 
    CHECK (
      (start_date IS NULL OR end_date IS NULL) OR 
      (end_date >= start_date)
    );
  END IF;
END $$;