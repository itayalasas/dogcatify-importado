/*\n  # Add Dotty Assistant Visibility Setting\n\n  1. Changes\n    - Add `dotty_enabled` column to profiles table\n    - Default value: true (Dotty visible by default)\n    - Allows users to hide/show Dotty assistant from their profile settings\n\n  2. Security\n    - Users can only update their own dotty_enabled setting\n*/\n\n-- Add dotty_enabled column to profiles\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'profiles' AND column_name = 'dotty_enabled'\n  ) THEN\n    ALTER TABLE profiles ADD COLUMN dotty_enabled boolean DEFAULT true NOT NULL;
\n  END IF;
\nEND $$;
\n\n-- Update existing users to have Dotty enabled by default\nUPDATE profiles SET dotty_enabled = true WHERE dotty_enabled IS NULL;
\n;
