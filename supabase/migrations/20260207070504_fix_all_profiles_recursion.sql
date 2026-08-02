/*
  # Eliminar todas las polÃ­ticas recursivas de profiles
  
  1. Problema
    - Las polÃ­ticas de admin que consultan profiles desde policies de profiles causan recursiÃ³n
    - "Admins can update all profiles" y "Admins can delete profiles" tienen el mismo problema
  
  2. SoluciÃ³n
    - Eliminar estas polÃ­ticas problemÃ¡ticas
    - La polÃ­tica "Enable read access for all users" ya permite SELECT a todos
    - Los usuarios pueden actualizar sus propios perfiles con las polÃ­ticas existentes
*/

-- Eliminar polÃ­ticas de admin que causan recursiÃ³n
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

;


