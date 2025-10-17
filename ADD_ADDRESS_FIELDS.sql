-- Script SQL para agregar campos de dirección a la tabla profiles
-- Ejecutar manualmente en la consola de Supabase SQL Editor

-- Agregar campos de dirección a la tabla profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_locality text,
  ADD COLUMN IF NOT EXISTS address_department text,
  ADD COLUMN IF NOT EXISTS address_phone text;

-- Comentario: Estos campos permiten almacenar la dirección completa del usuario
-- que se cargará automáticamente en el carrito de compras
