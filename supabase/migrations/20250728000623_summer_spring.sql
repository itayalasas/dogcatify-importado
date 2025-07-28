-- Corregir recursión infinita en políticas RLS de profiles
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar todas las políticas problemáticas
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read push tokens" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- 2. Crear política simple para lectura pública (como estaba antes)
CREATE POLICY "Enable read access for all users"
ON profiles
FOR SELECT
TO public
USING (true);

-- 3. Crear política simple para actualización de perfil propio
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 4. Verificar que las políticas se crearon correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;