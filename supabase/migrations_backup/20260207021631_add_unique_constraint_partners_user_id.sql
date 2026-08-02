/*\n  # Add UNIQUE constraint to partners.user_id\n\n  This migration adds a UNIQUE constraint to the user_id column in the partners table\n  to ensure that each user can only have one partner record.\n\n  ## Changes\n  1. Add UNIQUE constraint to user_id column in partners table\n  \n  ## Security\n  - This constraint ensures data integrity by preventing duplicate partner records per user\n*/\n\nDO $$\nBEGIN\n  -- Add UNIQUE constraint if it doesn't exist\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_constraint \n    WHERE conname = 'partners_user_id_unique' \n    AND conrelid = 'partners'::regclass\n  ) THEN\n    ALTER TABLE partners \n    ADD CONSTRAINT partners_user_id_unique UNIQUE (user_id);
\n  END IF;
\nEND $$;
\n;
