/*
  # Agregar polÃ­ticas SELECT para administradores
  
  1. Cambios
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los bookings
    - Agregar polÃ­tica SELECT para que administradores puedan ver todos los productos
  
  2. Seguridad
    - Solo usuarios con is_admin = true pueden acceder a todos los datos
    - Se mantienen las polÃ­ticas existentes para usuarios regulares y partners
*/

-- Eliminar polÃ­tica si existe y recrearla para bookings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bookings' 
    AND policyname = 'Admins can view all bookings'
  ) THEN
    DROP POLICY "Admins can view all bookings" ON bookings;

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );


-- Eliminar polÃ­tica si existe y recrearla para partner_products
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'partner_products' 
    AND policyname = 'Admins can view all products'
  ) THEN
    DROP POLICY "Admins can view all products" ON partner_products;

  END IF;

END $$;


-- PolÃ­tica SELECT para que admins vean todos los productos
CREATE POLICY "Admins can view all products"
  ON partner_products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

;


