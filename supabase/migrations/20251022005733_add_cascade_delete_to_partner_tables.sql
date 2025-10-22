/*
  # Agregar eliminación en cascada para tablas relacionadas con partners

  1. Cambios
    - Actualizar constraint de `partner_services.partner_id` para usar ON DELETE CASCADE
    - Actualizar constraint de `partner_products.partner_id` para usar ON DELETE CASCADE
    - Actualizar constraint de `business_schedule.partner_id` para usar ON DELETE CASCADE
    - Actualizar constraint de `bookings.partner_id` para usar ON DELETE CASCADE
    - Actualizar constraint de `orders.partner_id` para usar ON DELETE CASCADE

  2. Propósito
    - Permitir que al eliminar un negocio (partner) se eliminen automáticamente todos sus datos relacionados
    - Mantener la integridad referencial de la base de datos
    - Evitar registros huérfanos

  3. Notas importantes
    - Esta operación es segura porque solo afecta la acción de eliminación
    - Los datos existentes no se modifican
    - Se eliminan las constraints antiguas y se crean nuevas con CASCADE
*/

-- Eliminar y recrear constraint para partner_services
ALTER TABLE partner_services
  DROP CONSTRAINT IF EXISTS partner_services_partner_id_fkey;

ALTER TABLE partner_services
  ADD CONSTRAINT partner_services_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES partners(id)
  ON DELETE CASCADE;

-- Eliminar y recrear constraint para partner_products
ALTER TABLE partner_products
  DROP CONSTRAINT IF EXISTS partner_products_partner_id_fkey;

ALTER TABLE partner_products
  ADD CONSTRAINT partner_products_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES partners(id)
  ON DELETE CASCADE;

-- Eliminar y recrear constraint para business_schedule
ALTER TABLE business_schedule
  DROP CONSTRAINT IF EXISTS business_schedule_partner_id_fkey;

ALTER TABLE business_schedule
  ADD CONSTRAINT business_schedule_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES partners(id)
  ON DELETE CASCADE;

-- Eliminar y recrear constraint para bookings
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_partner_id_fkey;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES partners(id)
  ON DELETE CASCADE;

-- Eliminar y recrear constraint para orders
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_partner_id_fkey;

ALTER TABLE orders
  ADD CONSTRAINT orders_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES partners(id)
  ON DELETE CASCADE;
