/*\n  # Agregar políticas SELECT para administradores\n  \n  1. Cambios\n    - Agregar política SELECT para que administradores puedan ver todos los bookings\n    - Agregar política SELECT para que administradores puedan ver todos los productos\n  \n  2. Seguridad\n    - Solo usuarios con is_admin = true pueden acceder a todos los datos\n    - Se mantienen las políticas existentes para usuarios regulares y partners\n*/\n\n-- Eliminar política si existe y recrearla para bookings\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_policies \n    WHERE tablename = 'bookings' \n    AND policyname = 'Admins can view all bookings'\n  ) THEN\n    DROP POLICY "Admins can view all bookings" ON bookings;
\n  END IF;
\nEND $$;
\n\n-- Política SELECT para que admins vean todos los bookings\nCREATE POLICY "Admins can view all bookings"\n  ON bookings\n  FOR SELECT\n  TO authenticated\n  USING (\n    EXISTS (\n      SELECT 1 FROM profiles\n      WHERE profiles.id = auth.uid()\n      AND profiles.is_admin = true\n    )\n  );
\n\n-- Eliminar política si existe y recrearla para partner_products\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_policies \n    WHERE tablename = 'partner_products' \n    AND policyname = 'Admins can view all products'\n  ) THEN\n    DROP POLICY "Admins can view all products" ON partner_products;
\n  END IF;
\nEND $$;
\n\n-- Política SELECT para que admins vean todos los productos\nCREATE POLICY "Admins can view all products"\n  ON partner_products\n  FOR SELECT\n  TO authenticated\n  USING (\n    EXISTS (\n      SELECT 1 FROM profiles\n      WHERE profiles.id = auth.uid()\n      AND profiles.is_admin = true\n    )\n  );
\n;
