/*
  # Agregar polÃ­ticas SELECT para dashboard de administradores
  
  1. Cambios
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los profiles
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los partners
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los pets
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los orders
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los places
    - Agregar polÃ­tica SELECT para que administradores puedan ver todas las promotions
  
  2. Seguridad
    - Solo usuarios con is_admin = true pueden acceder a todos los datos
    - Se mantienen las polÃ­ticas existentes para usuarios regulares y partners
*/

-- PolÃ­tica SELECT para que admins vean todos los profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.is_admin = true
        )
      );

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'partners' 
    AND policyname = 'Admins can view all partners'
  ) THEN
    CREATE POLICY "Admins can view all partners"
      ON partners
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los pets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pets' 
    AND policyname = 'Admins can view all pets'
  ) THEN
    CREATE POLICY "Admins can view all pets"
      ON pets
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND policyname = 'Admins can view all orders'
  ) THEN
    CREATE POLICY "Admins can view all orders"
      ON orders
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los places
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Admins can view all places'
  ) THEN
    CREATE POLICY "Admins can view all places"
      ON places
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todas las promotions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'promotions' 
    AND policyname = 'Admins can view all promotions'
  ) THEN
    CREATE POLICY "Admins can view all promotions"
      ON promotions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

  END IF;

END $$;

;


