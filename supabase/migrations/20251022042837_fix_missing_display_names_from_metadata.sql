/*
  # Corregir display_names faltantes desde metadata de auth

  1. Descripción
    - Copiar nombres desde auth.users.raw_user_meta_data a profiles.display_name
    - Solo actualiza perfiles que tienen display_name en NULL
    - Obtiene el nombre de raw_user_meta_data.full_name

  2. Cambios
    - Actualiza profiles.display_name con el valor de full_name desde auth metadata
    - Solo afecta registros donde display_name es NULL
*/

-- Actualizar display_names faltantes desde metadata de auth
UPDATE profiles
SET 
  display_name = (
    SELECT raw_user_meta_data->>'full_name'
    FROM auth.users
    WHERE auth.users.id = profiles.id
  ),
  updated_at = now()
WHERE 
  display_name IS NULL
  AND EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.id = profiles.id 
    AND raw_user_meta_data->>'full_name' IS NOT NULL
  );
