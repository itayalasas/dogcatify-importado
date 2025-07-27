/*
  # Add likes column to promotions table

  1. Changes
    - Add `likes` column to `promotions` table as text array
    - Set default value as empty array
    - Allow null values initially for existing records

  2. Security
    - No RLS changes needed as existing policies will apply
*/

-- Add likes column to promotions table
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS likes text[] DEFAULT '{}';

-- Update existing promotions to have empty likes array
UPDATE promotions 
SET likes = '{}' 
WHERE likes IS NULL;