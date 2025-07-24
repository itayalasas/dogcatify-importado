/*
  # Agregar columna color a la tabla pets
  
  1. Cambios
    - Agrega la columna 'color' a la tabla 'pets'
*/

-- Agregar columna color a la tabla pets
ALTER TABLE IF EXISTS public.pets
ADD COLUMN IF NOT EXISTS color text;