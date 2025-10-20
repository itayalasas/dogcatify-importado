/*
  # Agregar campo RUT a partners

  1. Cambios
    - Agregar columna `rut` a la tabla `partners`
    - Tipo TEXT para permitir formato flexible (ej: 12345678-9)
    - Campo opcional (nullable) por compatibilidad con registros existentes

  2. Notas
    - El RUT será requerido en el frontend para nuevos registros
    - Registros antiguos pueden actualizarse posteriormente
*/

-- Agregar columna RUT a la tabla partners
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS rut TEXT;

-- Agregar índice para búsquedas por RUT
CREATE INDEX IF NOT EXISTS idx_partners_rut ON partners(rut);

-- Agregar comentario a la columna
COMMENT ON COLUMN partners.rut IS 'RUT del negocio/empresa (formato flexible: 12345678-9)';
