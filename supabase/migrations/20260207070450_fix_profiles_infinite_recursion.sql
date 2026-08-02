/*
  # Corregir recursiÃ³n infinita en polÃ­ticas de profiles
  
  1. Problema
    - La polÃ­tica "Admins can view all profiles" causa recursiÃ³n infinita
    - Al verificar is_admin consulta profiles dentro de la polÃ­tica de profiles
  
  2. SoluciÃ³n
    - Eliminar la polÃ­tica problemÃ¡tica de profiles
    - Los administradores ya pueden ver profiles a travÃ©s de otras polÃ­ticas
*/

-- Eliminar la polÃ­tica problemÃ¡tica que causa recursiÃ³n infinita
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

;


