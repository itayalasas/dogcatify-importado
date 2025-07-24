/*
  # Actualizar tabla pet_health para seguimiento de peso

  1. Cambios
    - Asegura que la columna 'date' existe para almacenar la fecha del registro
    - Añade columnas 'weight' y 'weight_unit' para almacenar el peso y su unidad
*/

-- Asegurar que la columna 'date' existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_health' AND column_name = 'date'
  ) THEN
    ALTER TABLE pet_health ADD COLUMN date text;
  END IF;
END $$;

-- Asegurar que la columna 'weight' existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_health' AND column_name = 'weight'
  ) THEN
    ALTER TABLE pet_health ADD COLUMN weight text;
  END IF;
END $$;

-- Asegurar que la columna 'weight_unit' existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_health' AND column_name = 'weight_unit'
  ) THEN
    ALTER TABLE pet_health ADD COLUMN weight_unit text;
  END IF;
END $$;