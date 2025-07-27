-- Actualizar política RLS para permitir que los usuarios actualicen su push_token
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política para que los administradores puedan leer push_tokens para enviar notificaciones
CREATE POLICY IF NOT EXISTS "Admins can read push tokens"
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