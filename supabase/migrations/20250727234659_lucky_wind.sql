-- Script de verificación para confirmar que todo está configurado correctamente

-- 1. Verificar que las columnas existen
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('push_token', 'notification_preferences');

-- 2. Verificar que los índices existen
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE '%push_token%';

-- 3. Verificar políticas RLS
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Contar usuarios con push_token (debería ser 0 inicialmente)
SELECT 
  COUNT(*) as total_users,
  COUNT(push_token) as users_with_push_token
FROM profiles;