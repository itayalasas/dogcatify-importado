-- Scripts de prueba para notificaciones (OPCIONAL - solo para testing)

-- Simular un push_token para testing (reemplaza 'your-user-id' con un ID real)
-- UPDATE profiles 
-- SET push_token = 'ExponentPushToken[test-token-123]'
-- WHERE id = 'your-user-id';

-- Verificar que el token se guardó
-- SELECT id, email, push_token 
-- FROM profiles 
-- WHERE push_token IS NOT NULL;

-- Limpiar tokens de prueba (ejecutar después de testing)
-- UPDATE profiles 
-- SET push_token = NULL 
-- WHERE push_token LIKE 'ExponentPushToken[test-%';