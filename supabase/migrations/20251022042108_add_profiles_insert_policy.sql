/*
  # Agregar política de INSERT para profiles

  1. Cambios
    - Agregar política para permitir que usuarios autenticados creen su propio perfil
    - Esto es necesario para el flujo de registro donde el usuario crea su perfil después de la autenticación

  2. Seguridad
    - Solo usuarios autenticados pueden insertar
    - Solo pueden crear un perfil con su propio user ID (auth.uid())
    - Política restrictiva que previene crear perfiles para otros usuarios
*/

-- Política para permitir que usuarios creen su propio perfil
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
