/*\n  # Add payment_link column to bookings table\n\n  1. Changes\n    - Add payment_link column to bookings table to store Mercado Pago payment links\n  \n  2. Notes\n    - Column is nullable as it's only used when payment_method is 'payment_link'\n    - No default value needed\n*/\n\n-- Add payment_link column if it doesn't exist\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'bookings' AND column_name = 'payment_link'\n  ) THEN\n    ALTER TABLE bookings ADD COLUMN payment_link text;
\n  END IF;
\nEND $$;
\n;
