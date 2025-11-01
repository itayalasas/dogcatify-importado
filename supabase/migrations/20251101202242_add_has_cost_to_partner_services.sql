/*
  # Agregar campo has_cost a servicios de partners
  
  1. Cambios
    - Agregar columna `has_cost` a `partner_services`
      - Tipo: boolean
      - Default: true (para mantener compatibilidad con servicios existentes)
      - NOT NULL
    
  2. Notas
    - Los servicios existentes se marcarán automáticamente como "con costo" (has_cost = true)
    - Si has_cost = false, el servicio es gratuito y no requiere pago
    - Si has_cost = true, el servicio requiere pago a través de Mercado Pago
*/

-- Add has_cost column to partner_services
ALTER TABLE partner_services 
ADD COLUMN IF NOT EXISTS has_cost boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN partner_services.has_cost IS 'Indica si el servicio tiene costo (true) o es gratuito (false). Los servicios gratuitos crean reservas directamente sin pago.';
