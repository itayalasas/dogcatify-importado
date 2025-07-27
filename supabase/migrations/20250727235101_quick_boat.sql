-- Actualizar política RLS para permitir que los usuarios actualicen su push_token
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Eliminar política anterior si existe
DROP POLICY IF EXISTS "Admins can read push tokens" ON profiles;

-- Política para que los administradores puedan leer push_tokens para enviar notificaciones
CREATE POLICY "Admins can read push tokens"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.email = 'admin@dogcatify.com'
  )
);

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname IN ('Users can update their own profile', 'Admins can read push tokens');